import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { numberInString, WsMessageAggTradeRaw } from 'binance'
import { BinanceWebSocketService } from './BinanceWebsocketService'
import { CacheService } from '@cache/cache.service'
import { DatabaseService } from '@database/database.service'
import { aggregationIntervalMap } from '@orderflow/constants/aggregation'
import { findAllEffectedIntervalsOnCandleClose } from '@orderflow/utils/candleBuildHelper'
import { CandleQueue } from '@orderflow/utils/candleQueue'
import { OrderFlowAggregator } from '@orderflow/utils/orderFlowAggregator'
import { mergeFootPrintCandles } from '@orderflow/utils/orderFlowUtil'
import { INTERVALS } from '@shared/utils/intervals'
import { KlineIntervalMs } from '@shared/constants/intervals'
import { CACHE_LIMIT, Exchange } from '@shared/constants/exchange'
import { IFootPrintClosedCandle } from '@orderflow/dto/orderflow.dto'

@Injectable()
export class BinanceService {
  private logger: Logger = new Logger(BinanceService.name)
  private symbols: string[] = process.env.SYMBOLS?.split(',') ?? ['BTCUSDT']
  private readonly BASE_INTERVAL = INTERVALS.ONE_MINUTE
  private readonly HTF_INTERVALS = [
    INTERVALS.FIVE_MINUTES,
    INTERVALS.FIFTEEN_MINUTES,
    INTERVALS.THIRTY_MINUTES,
    INTERVALS.ONE_HOUR,
    INTERVALS.TWO_HOURS,
    INTERVALS.FOUR_HOURS,
    INTERVALS.EIGHT_HOURS,
    INTERVALS.TWELVE_HOURS,
    INTERVALS.ONE_DAY,
    INTERVALS.ONE_WEEK,
    INTERVALS.ONE_MONTH
  ]

  private expectedConnections: Map<string, Date> = new Map()
  private openConnections: Map<string, Date> = new Map()
  private wsKeyContextStore: Record<string, { symbol: string }> = {}
  private didFinishConnectingWS: boolean = false

  private aggregators: { [symbol: string]: OrderFlowAggregator } = {}
  private candleQueue: CandleQueue

  constructor(
    private readonly cacheService: CacheService,
    private readonly databaseService: DatabaseService,
    private readonly binanceWsService: BinanceWebSocketService
  ) {
    this.candleQueue = new CandleQueue(this.databaseService)
    this
  }

  async onModuleInit() {
    this.logger.log(`Starting Binance Orderflow service for Live candle building from raw trades`)

    await this.loadSymbols()
    await this.subscribeToWS()
  }

  async loadSymbols(): Promise<void> {
    try {
      const exchangeSymbolTickSizes: { [symbol: string]: string } = await this.cacheService.getSymbols(Exchange.BINANCE)

      if (Object.keys(exchangeSymbolTickSizes).length > 0) {
        this.symbols = Object.keys(exchangeSymbolTickSizes)
      } else {
        this.logger.warn('No symbols returned from cache service, using default symbols')
      }
    } catch (error) {
      this.logger.error('Failed to fetch symbols:', error)
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async handlePrune() {
    await this.databaseService.pruneOldData()
  }

  private async subscribeToWS(): Promise<void> {
    for (let i = 0; i < this.symbols.length; i++) {
      const response = this.binanceWsService.subscribeToTrades(this.symbols[i], 'usdm')

      const wsKey = response.wsKey

      if (wsKey) {
        this.wsKeyContextStore[wsKey] = { symbol: this.symbols[i] }
        this.expectedConnections.set(wsKey, new Date())
      } else {
        this.logger.error('no wskey? ' + { symbol: this.symbols[i], wsKey })
      }
    }

    this.binanceWsService.connected.subscribe((wsKey) => {
      this.openConnections.set(wsKey, new Date())

      const totalExpected = this.expectedConnections.size
      const totalConnected = this.openConnections.size
      this.logger.log(`Total ${totalConnected}/${totalExpected} ws connections open | (${wsKey} connected)`)

      if (totalConnected === totalExpected) {
        this.logger.log(`All WS connections are now open`)
        this.didFinishConnectingWS = true
      }
    })

    this.binanceWsService.tradeUpdates.subscribe((trade: WsMessageAggTradeRaw) => {
      this.processNewTrades(trade.s, trade.m, trade.q, trade.p)
    })
  }

  private getOrderFlowAggregator(symbol: string, interval: string): OrderFlowAggregator {
    if (!this.aggregators[symbol]) {
      const intervalSizeMs: number = KlineIntervalMs[interval]
      if (!intervalSizeMs) {
        throw new Error(`Unknown ms per interval "${interval}"`)
      }

      const maxRowsInMemory = CACHE_LIMIT
      this.aggregators[symbol] = new OrderFlowAggregator('binance', symbol, interval, intervalSizeMs, {
        maxCacheInMemory: maxRowsInMemory
      })
    }

    return this.aggregators[symbol]
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async processMinuteCandleClose() {
    if (!this.didFinishConnectingWS) {
      return
    }

    const closed1mCandles: { [symbol: string]: IFootPrintClosedCandle } = {}

    for (const symbol in this.aggregators) {
      const aggr = this.getOrderFlowAggregator(symbol, this.BASE_INTERVAL)
      const closed1mCandle = aggr.processCandleClosed()

      if (closed1mCandle) {
        this.candleQueue.enqueCandle(closed1mCandle)
        closed1mCandles[symbol] = closed1mCandle
      }
    }

    await this.candleQueue.persistCandlesToStorage({ clearQueue: true })

    for (const symbol in this.aggregators) {
      const closed1mCandle = closed1mCandles[symbol]
      if (closed1mCandle) {
        const nextOpenTimeMS = 1 + closed1mCandle.closeTimeMs
        const nextOpenTime = new Date(nextOpenTimeMS)
        const triggeredIntervals: INTERVALS[] = findAllEffectedIntervalsOnCandleClose(nextOpenTime, this.HTF_INTERVALS)

        for (const interval of this.HTF_INTERVALS) {
          if (triggeredIntervals.includes(interval)) {
            await this.buildHTFCandle(symbol, interval, closed1mCandle.openTimeMs, closed1mCandle.closeTimeMs)
          }
        }
      }
    }

    await this.candleQueue.persistCandlesToStorage({ clearQueue: true })
  }

  async buildHTFCandle(symbol: string, targetInterval: INTERVALS, openTimeMs: number, closeTimeMs: number) {
    const { baseInterval, count } = aggregationIntervalMap[targetInterval]

    this.logger.log(`Building a new HTF candle for ${symbol} ${targetInterval}. Will attempt to find and use ${count} ${baseInterval} candles`)

    const baseIntervalMs = KlineIntervalMs[baseInterval]
    const aggregationStart = closeTimeMs - baseIntervalMs * count
    const aggregationEnd = closeTimeMs

    const candles = await this.databaseService.getCandles(Exchange.BINANCE, symbol, baseInterval, aggregationStart, aggregationEnd)

    if (candles?.length === count) {
      const aggregatedCandle = mergeFootPrintCandles(candles, targetInterval)
      if (aggregatedCandle) {
        this.candleQueue.enqueCandle(aggregatedCandle)
      }
    } else {
      this.logger.warn(
        `Target candle count ${count} was not met to create a new candle for ${symbol}, ${targetInterval}. Candle closed at ${new Date(closeTimeMs)}`
      )
    }
  }

  private processNewTrades(symbol: string, isBuyerMaker: boolean, positionSize: numberInString, price: numberInString) {
    if (!this.didFinishConnectingWS) {
      return
    }

    const aggr = this.getOrderFlowAggregator(symbol, this.BASE_INTERVAL)
    aggr.processNewTrades(isBuyerMaker, Number(positionSize), Number(price))
  }
}
