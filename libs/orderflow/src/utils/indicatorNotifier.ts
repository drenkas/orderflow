import * as ta from 'chart-patterns';
import { AppDataSource } from '@database/ormconfig';
import { FootPrintCandle } from '@database/entity/footprint_candle.entity';
import { TelegramService } from '@shared/telegram.service';
import { INTERVALS } from '@shared/utils/intervals';
import { Exchange } from '@shared/constants/exchange';
import { OrderFlowRow, IStackedImbalancesResult } from 'chart-patterns/dist/types/orderflow';
import { ICandle } from 'chart-patterns/dist/types/candle.types';

/**
 * Compute indicators for the last `lookback` candles of a symbol/interval and broadcast a Telegram message if conditions met.
 */
export async function computeAndSendNotification(
  telegram: TelegramService,
  symbol: string,
  interval: INTERVALS,
  lookback = 60
): Promise<void> {
  const watchIntervals = [INTERVALS.FIFTEEN_MINUTES, INTERVALS.THIRTY_MINUTES, INTERVALS.ONE_HOUR, INTERVALS.FOUR_HOURS, INTERVALS.ONE_DAY];
  if (!watchIntervals.includes(interval)) return;

  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }

  const repo = AppDataSource.getRepository(FootPrintCandle);
  const rows = await repo.find({
    where: { exchange: Exchange.BINANCE, symbol, interval },
    order: { openTime: 'DESC' as const },
    take: lookback
  });

  if (rows.length === 0) return;

  const candlesAsc = rows.reverse();
  const cpCandles: ICandle[] = candlesAsc.map((c) => ({
    symbol: c.symbol,
    interval: c.interval,
    openTime: new Date(c.openTime),
    closeTime: new Date(c.closeTime),
    open: c.close,
    high: c.high,
    low: c.low,
    close: c.close,
    volume: c.volume
  }));

  // Fallback EMA calculator (period EMA of close prices)
  const closesArr = cpCandles.map((c) => c.close);
  const calcEma = (values: number[], period: number): number => {
    const k = 2 / (period + 1);
    let emaVal = values[0];
    for (let i = 1; i < values.length; i++) {
      emaVal = values[i] * k + emaVal * (1 - k);
    }
    return emaVal;
  };

  const ema9 = calcEma(closesArr, 9);
  const ema21 = calcEma(closesArr, 21);

  // RSI via chart-patterns if доступно, інакше фолбек
  let rsi: number;
  let rsiArr: number[] | undefined;
  try {
    const rsiCalcRes: any = ta.RSI.calculateRSI(cpCandles);
    if (Array.isArray(rsiCalcRes)) {
      rsiArr = rsiCalcRes as number[];
      rsi = rsiArr[rsiArr.length - 1];
    } else {
      rsi = rsiCalcRes as number;
    }
  } catch (_) {
    const gains: number[] = [];
    const losses: number[] = [];
    for (let i = 1; i < closesArr.length; i++) {
      const diff = closesArr[i] - closesArr[i - 1];
      if (diff >= 0) gains.push(diff);
      else losses.push(Math.abs(diff));
    }
    const avgGain = gains.reduce((a, b) => a + b, 0) / gains.length || 0.0001;
    const avgLoss = losses.reduce((a, b) => a + b, 0) / losses.length || 0.0001;
    const rs = avgGain / avgLoss;
    rsi = 100 - 100 / (1 + rs);
  }

  const lastClose = closesArr[closesArr.length - 1];

  // Detect RSI divergence (bullish / bearish)
  let rsiDivergence: 'bullish' | 'bearish' | undefined;
  if (rsiArr && rsiArr.length >= 20) {
    rsiDivergence = detectRSIDivergence(closesArr.slice(-20), rsiArr.slice(-20));
  }

  // Orderflow: analyze last few candles for stacked imbalances
  const ORDERFLOW_LOOKBACK = 3;
  const STACKED_CONFIG = { stackCount: 3, threshold: 150, tickSize: 0.1 };

  const stacked: IStackedImbalancesResult[] = [];

  const recentFootprints = candlesAsc.slice(-ORDERFLOW_LOOKBACK);
  recentFootprints.forEach((fp) => {
    const rows: Record<string, OrderFlowRow> = {};
    for (const price in fp.priceLevels) {
      const lvl = fp.priceLevels[price];
      rows[price] = { volSumAsk: lvl.volSumAsk, volSumBid: lvl.volSumBid };
    }
    const s = ta.Orderflow.detectStackedImbalances(rows, STACKED_CONFIG);
    if (s && s.length) stacked.push(...s);
  });

  // HVN still по останній свічці (можна розширити, якщо треба)
  const lastFootprint = recentFootprints[recentFootprints.length - 1];
  const lastOfRows: Record<string, OrderFlowRow> = {};
  for (const price in lastFootprint.priceLevels) {
    const lvl = lastFootprint.priceLevels[price];
    lastOfRows[price] = { volSumAsk: lvl.volSumAsk, volSumBid: lvl.volSumBid };
  }

  const hvn = ta.Orderflow.findHighVolumeNodes(lastOfRows, { threshold: 0.3 });

  const sr = aggregateStackedLevels(stacked, 0.1, 2);

  // VWAP
  const vwapSession = ta.VWAP.createSession(2);
  cpCandles.forEach((c) => vwapSession.processCandle(c));
  const vwap = vwapSession.getVWAP();

  // Volume Profile (VAH/VAL/POC) for higher TFs
  let vah: number | undefined;
  let val: number | undefined;
  let poc: number | undefined;
  if ([INTERVALS.ONE_HOUR, INTERVALS.FOUR_HOURS, INTERVALS.ONE_DAY].includes(interval)) {
    const vpSession = ta.VolumeProfile.createBarSession({ valueAreaRowSize: 24, valueAreaVolume: 0.7, pricePrecision: 2 });
    cpCandles.forEach((c) => vpSession.processCandle(c));
    const vp = vpSession.getVolumeDistribution() as any;
    vah = vp.vah ?? vp.valueAreaHigh;
    val = vp.val ?? vp.valueAreaLow;
    poc = vp.poc ?? vp.pointOfControl;
  }

  // Compose lines
  const lines: string[] = [];
  // Always include RSI line with status
  const rsiStatus = rsi >= 70 ? ' (overbought)' : rsi <= 30 ? ' (oversold)' : '';
  lines.push(`— RSI ${rsi.toFixed(1)}${rsiStatus}`);

  if (hvn.length > 0) {
    lines.push(
      `— HVN @ ${hvn
        .map((n: any) => {
          const price = (n.price ?? n.nodePrice)?.toFixed(2);
          const pct = n.nodeVolumePercent ? `(${(n.nodeVolumePercent * 100).toFixed(0)}%)` : '';
          return `${price}${pct}`;
        })
        .join(', ')}`
    );
  }

  // Include stacked imbalance based S/R for all intervals
  if (sr.resistance.length || sr.support.length) {
    const res = sr.resistance
      .map((l) => `${l.price.toFixed(2)}(${l.hits})`)
      .slice(0, 3)
      .join(', ');
    const sup = sr.support
      .map((l) => `${l.price.toFixed(2)}(${l.hits})`)
      .slice(0, 3)
      .join(', ');
    lines.push(`— Stack SR: R [${res || '—'}] S [${sup || '—'}]`);
  }

  // Append RSI divergence info
  if (rsiDivergence) {
    lines.push(`— RSI divergence detected: ${rsiDivergence}`);
  }

  if ([INTERVALS.ONE_HOUR, INTERVALS.FOUR_HOURS, INTERVALS.ONE_DAY].includes(interval)) {
    // Removed duplicate SR levels line (now included for all TFs above)

    if (typeof vwap === 'number' && !isNaN(vwap)) {
      const diff = ((lastClose - vwap) / vwap) * 100;
      lines.push(`— Price ${Math.abs(diff).toFixed(2)}% ${diff > 0 ? 'above' : 'below'} VWAP`);
    }

    if (ema9 && ema21) {
      lines.push(`— EMA9 ${ema9 > ema21 ? '>' : '<'} EMA21 (${ema9 > ema21 ? 'bullish' : 'bearish'})`);
    }

    if (vah !== undefined && val !== undefined && poc !== undefined) {
      lines.push(`— Volume Profile: VAH ${vah.toFixed(2)} | VAL ${val.toFixed(2)} | POC ${poc.toFixed(2)}`);
    }
  }

  if (lines.length) {
    const header = `${symbol} ${interval} candle closed`;
    const msg = [header, ...lines].join('\n');
    await telegram.broadcast(msg);
  }
}

function aggregateStackedLevels(imbalances: IStackedImbalancesResult[], tickSize: number, minHits = 2) {
  const buckets: Record<string, { price: number; side: string; hits: number; maxStack: number }> = {};

  imbalances.forEach((im) => {
    const start = Number(im.imbalanceStartAt);
    const end = Number(im.imbalanceEndAt);
    const midPrice = (start + end) / 2;
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

/**
 * Very simple RSI divergence detector operating on last N candles.
 * Bullish divergence: price makes lower low while RSI makes higher low.
 * Bearish divergence: price makes higher high while RSI makes lower high.
 */
function detectRSIDivergence(prices: number[], rsiVals: number[]): 'bullish' | 'bearish' | undefined {
  if (prices.length < 4 || prices.length !== rsiVals.length) return;

  // Helper to find last two extrema indices within the series
  const findLastTwoExtremes = (arr: number[], comparator: (a: number, b: number) => boolean) => {
    const extremaIdx: number[] = [];
    for (let i = arr.length - 2; i >= 1 && extremaIdx.length < 2; i--) {
      if (comparator(arr[i], arr[i - 1]) && comparator(arr[i], arr[i + 1])) {
        extremaIdx.push(i);
      }
    }
    return extremaIdx;
  };

  // Look for lows (bullish divergence)
  const lowIdx = findLastTwoExtremes(prices, (a, b) => a < b);
  if (lowIdx.length === 2) {
    const [recentLow, prevLow] = lowIdx;
    if (prices[recentLow] < prices[prevLow] && rsiVals[recentLow] > rsiVals[prevLow]) {
      return 'bullish';
    }
  }

  // Look for highs (bearish divergence)
  const highIdx = findLastTwoExtremes(prices, (a, b) => a > b);
  if (highIdx.length === 2) {
    const [recentHigh, prevHigh] = highIdx;
    if (prices[recentHigh] > prices[prevHigh] && rsiVals[recentHigh] < rsiVals[prevHigh]) {
      return 'bearish';
    }
  }

  return undefined;
}
