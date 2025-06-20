import 'dotenv/config';

import * as fs from 'fs';
import * as path from 'path';
import { AppDataSource } from '@database/ormconfig';
import { FootPrintCandle } from '@database/entity/footprint_candle.entity';
import * as ta from 'chart-patterns';
import { ICandle } from 'chart-patterns/dist/types/candle.types';
import { INTERVALS, KlineIntervalMs } from '@shared/constants/intervals';
import { IStackedImbalancesResult, OrderFlowRow } from 'chart-patterns/dist/types/orderflow';

// -- Configuration ---------------------------------------------------------
const INTERVAL = INTERVALS.FOUR_HOURS;
const INTERVAL_MIN_MS = KlineIntervalMs[INTERVAL];
const OUTPUT_DIR = path.resolve(__dirname, '../output');
const LOOKBACK_BARS = Number(process.env.LOOKBACK_BARS ?? 36); // default 9h history
const EXCHANGE = process.env.EXCHANGE ?? 'BINANCE';
const SYMBOLS = process.env.SYMBOLS ? process.env.SYMBOLS.split(',') : undefined; // optional comma-separated list

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function initDataSource() {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }
}

function toChartPatternsCandle(candle: FootPrintCandle): ICandle {
  return {
    symbol: candle.symbol,
    interval: candle.interval,
    openTime: new Date(candle.openTime),
    closeTime: new Date(candle.closeTime),
    open: candle.close, // fallback – open not tracked in footprint
    high: candle.high,
    low: candle.low,
    close: candle.close,
    volume: candle.volume
  };
}

function priceLevelsToOrderFlowRows(priceLevels: Record<string, { volSumAsk: number; volSumBid: number }>): Record<string, OrderFlowRow> {
  const rows: Record<string, OrderFlowRow> = {};
  for (const price in priceLevels) {
    const lvl = priceLevels[price];
    rows[price] = { volSumAsk: lvl.volSumAsk, volSumBid: lvl.volSumBid };
  }
  return rows;
}

// --- Helper ---------------------------------------------------------------
function aggregateStackedLevels(imbalances: IStackedImbalancesResult[], tickSize: number, minHits = 2) {
  const buckets: Record<string, { price: number; side: string; hits: number; maxStack: number }> = {};

  imbalances.forEach((im) => {
    const start = Number(im.imbalanceStartAt);
    const end = Number(im.imbalanceEndAt);
    const midPrice = (start + end) / 2;
    // bucket key by rounding to nearest tickSize
    const key = (Math.round(midPrice / tickSize) * tickSize).toFixed(2);
    if (!buckets[key]) {
      buckets[key] = { price: Number(key), side: im.imbalanceSide, hits: 0, maxStack: 0 };
    }
    buckets[key].hits += 1;
    buckets[key].maxStack = Math.max(buckets[key].maxStack, im.stackedCount);
  });

  const levels = Object.values(buckets).filter((b) => b.hits >= minHits);

  return {
    resistance: levels.filter((l) => l.side === 'ASK' || l.side === 'sell').sort((a, b) => b.price - a.price),
    support: levels.filter((l) => l.side === 'BID' || l.side === 'buy').sort((a, b) => a.price - b.price)
  };
}

async function processIndicators() {
  const repo = AppDataSource.getRepository(FootPrintCandle);

  // Determine symbols list
  const symbols: string[] = SYMBOLS ??
    (await repo
      .createQueryBuilder('candle')
      .select('DISTINCT candle.symbol', 'symbol')
      .where('candle.interval = :interval', { interval: INTERVAL })
      .getRawMany<{ symbol: string }>()
    ).map((r) => r.symbol);

  const results: any = { generatedAt: new Date().toISOString(), exchange: EXCHANGE, interval: INTERVAL, symbols: {} };

  console.log(`[Indicator] Symbols to process (${symbols.length}):`, symbols.join(', ') || '— none —');

  for (const symbol of symbols) {
    // Fetch latest LOOKBACK_BARS candles
    const recentCandles = await repo.find({
      where: {
        symbol,
        interval: INTERVAL
      },
      order: { openTime: 'DESC' },
      take: LOOKBACK_BARS
    });

    console.log(`[Indicator] ${symbol}: fetched ${recentCandles.length} candles`);

    if (!recentCandles.length) continue;

    const candles = recentCandles.reverse(); // chronological ASC
    const cpCandles = candles.map(toChartPatternsCandle);

    // ------- Moving Averages & RSI ------------------
    const emaOutcome = ta.MovingAverage.calculateEmas(cpCandles);
    const rsi = ta.RSI.calculateRSI(cpCandles);

    // ------- ZigZags & Ranges -----------------------
    const zScoreConfig = { lag: 2, threshold: 0.1, influence: 1 } as any;
    const ranges = ta.RangeBuilder.findRanges(cpCandles, zScoreConfig);
    const zigzags = ta.ZigZags.create(cpCandles, zScoreConfig);

    // ------- Pivot Points ---------------------------
    const pivots = ta.PivotPoints.calculatePivotPoints(cpCandles, 2);

    // ------- Peak Detector --------------------------
    const closes = cpCandles.map((c) => c.close);
    const peaks = ta.PeakDetector.findSignals({ values: closes, config: zScoreConfig });

    // ------- Market Profile -------------------------
    const mp = ta.MarketProfile.build({
      candles: cpCandles,
      candleGroupingPeriod: ta.constants.MARKET_PROFILE_PERIODS.DAILY,
      tickSize: 0.1,
      tickMultiplier: 100,
      timezone: 'UTC',
      pricePrecision: 2,
      includeProfileDistribution: false
    });

    // ------- Orderflow Indicators (last candle) -----
    const lastFootprint = candles[candles.length - 1];
    const OFRows = priceLevelsToOrderFlowRows(lastFootprint.priceLevels);
    const stackedImbalances = ta.Orderflow.detectStackedImbalances(OFRows, { stackCount: 3, threshold: 300, tickSize: 0.1 });
    const hvn = ta.Orderflow.findHighVolumeNodes(OFRows, { threshold: 0.2 });

    // --- Aggregate imbalance levels to derive S/R ------------------------
    const srLevels = aggregateStackedLevels(stackedImbalances, 0.1, 2);

    // ------- VWAP & Volume Profile ------------------
    const vwapSession = ta.VWAP.createSession(2);
    cpCandles.forEach((c) => vwapSession.processCandle(c));
    const vwap = vwapSession.getVWAP();

    const barSession = ta.VolumeProfile.createBarSession({ valueAreaRowSize: 24, valueAreaVolume: 0.7, pricePrecision: 2 });
    cpCandles.forEach((c) => barSession.processCandle(c));
    const volumeDistribution = barSession.getVolumeDistribution();

    // Aggregate results per symbol
    results.symbols[symbol] = {
      emaOutcome,
      rsi,
      zigzags,
      ranges,
      pivots,
      peaks,
      marketProfile: mp,
      orderflow: {
        stackedImbalances,
        highVolumeNodes: hvn,
        srLevels
      },
      vwap,
      volumeProfile: volumeDistribution
    };

    console.log(`[Indicator] ${symbol}: indicators computed`);
  }

  // Write to file ---------------------------------------------------
  const fileName = `indicators_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  fs.writeFileSync(path.join(OUTPUT_DIR, fileName), JSON.stringify(results, null, 2));
  console.log(`Indicators saved to ${fileName}`);
}

// -------------------------------------------------------------------
(async () => {
  await initDataSource();
  await processIndicators(); // immediate run
  setInterval(processIndicators, INTERVAL_MIN_MS);
})();
