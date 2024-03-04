import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { aggregationIntervalMap } from '@api/constants'
import { DatabaseService } from '@database/database.service'
import { IFootPrintClosedCandle } from '@orderflow/dto/orderflow.dto'
import { alignsWithTargetInterval } from '@orderflow/utils/date'
import { isMultipleOf } from '@orderflow/utils/math'
import { OrderFlowAggregator } from '@orderflow/utils/orderFlowAggregator'
import { mergeFootPrintCandles } from '@orderflow/utils/orderFlowUtil'
import { CACHE_LIMIT, Exchange, KlineIntervalMs } from '@tsquant/exchangeapi/dist/lib/constants'
import { INTERVALS } from '@tsquant/exchangeapi/dist/lib/constants/candles'
import { SymbolIntervalTimestampRangeDictionary } from '@tsquant/exchangeapi/dist/lib/types/candles.types'
import { BinanceWebSocketService } from 'apps/binance/src/BinanceWebsocketService'
import { numberInString, WsMessageAggTradeRaw } from 'binance'

const isMinuteMultipleOfFive = isMultipleOf(5)

@Injectable()
export class BinanceService {
  private logger: Logger = new Logger(BinanceService.name)
  private symbols: string[] = ['BTCUSDT']
  private readonly BASE_INTERVAL = '1m'
  private readonly LARGER_AGGREGATION_INTERVALS = [
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

  private timestampsRange: SymbolIntervalTimestampRangeDictionary = {}

  private expectedConnections: Map<string, Date> = new Map()
  private openConnections: Map<string, Date> = new Map()
  private wsKeyContextStore: Record<string, { symbol: string }> = {}
  private didFinishConnectingWS: boolean = false

  private aggregators: { [symbol: string]: OrderFlowAggregator } = {}

  constructor(private readonly databaseService: DatabaseService, private readonly binanceWsService: BinanceWebSocketService) {}

  async onModuleInit() {
    this.logger.log(`Starting binance service (WS etc)`)

    await this.subscribeToWS()
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
    if (this.didFinishConnectingWS) {
      for (const symbol in this.aggregators) {
        const aggr = this.getOrderFlowAggregator(symbol, this.BASE_INTERVAL)
        aggr.processCandleClosed()
        await this.persistCandlesToStorage(symbol, this.BASE_INTERVAL)

        const aggregationEnd = new Date()
        aggregationEnd.setMinutes(aggregationEnd.getMinutes() + 1, 0, 0)
        const closeMinute: number = aggregationEnd.getMinutes()
        const isCloseMinuteMultipleOfFive: boolean = isMinuteMultipleOfFive(closeMinute)

        if (isCloseMinuteMultipleOfFive) {
          for (const interval of this.LARGER_AGGREGATION_INTERVALS) {
            await this.updateTimestampRange(symbol, interval)
            const lastTimestamp = this.timestampsRange[symbol][interval]?.last

            // When this candle closes and when the next one in this interval is expected
            const closeTimeMS: number = aggregationEnd.getTime()
            const nextOpenTimeMS: number = lastTimestamp + KlineIntervalMs[interval]

            if (lastTimestamp && closeTimeMS === nextOpenTimeMS) {
              const aggregationStart = new Date(lastTimestamp)
              // Candles already exist in this interval
              await this.buildAggregatedCandle(symbol, interval, aggregationEnd, aggregationStart)
            } else if (!lastTimestamp) {
              // No timestamp for this interval exists means no aggregation has been performed on lower level intervals
              await this.buildAggregatedCandles(symbol, interval)
            }
          }
        }
      }
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async handlePrune() {
    await this.databaseService.pruneOldData()
  }

  async updateTimestampRange(symbol: string, interval: INTERVALS) {
    if (!this.timestampsRange[symbol]) {
      this.timestampsRange[symbol] = {}
    }

    if (!this.timestampsRange[symbol][interval]) {
      const resultMap = await this.databaseService.getTimestampRange(Exchange.BINANCE, symbol)
      if (resultMap[symbol]?.[interval]) {
        this.timestampsRange[symbol][interval] = resultMap[symbol][interval]
      }
    }
  }

  async buildAggregatedCandle(symbol: string, targetInterval: INTERVALS, aggregationEnd?: Date, aggregationStart?: Date) {
    const { baseInterval, count } = aggregationIntervalMap[targetInterval]
    const candles = await this.databaseService.getCandles(Exchange.BINANCE, symbol, baseInterval, aggregationStart, aggregationEnd)

    if (candles?.length === count) {
      const aggregatedCandle = mergeFootPrintCandles(candles, targetInterval)
      if (aggregatedCandle) {
        await this.databaseService.batchSaveFootPrintCandles([aggregatedCandle])
      }
    }
  }

  async buildAggregatedCandles(symbol: string, targetInterval: INTERVALS) {
    const { baseInterval, count } = aggregationIntervalMap[targetInterval]
    const candles = await this.databaseService.getCandles(Exchange.BINANCE, symbol, baseInterval)

    if (candles.length > 0) {
      const aggregatedCandles: IFootPrintClosedCandle[] = []

      // Find the first candle that aligns with the target interval
      const startIndex = candles.findIndex((candle) => alignsWithTargetInterval(targetInterval, new Date(candle.openTimeMs)))

      // Ensure startIndex is valid and adjust if necessary
      if (startIndex === -1) {
        // If no candle aligns with the interval, exit the function or handle as needed
        return
      }

      // Iterate over candles from the aligned start index, aggregating them into the target interval
      for (let i = startIndex; i < candles.length; i += count) {
        if (i + count <= candles.length) {
          const candleSubset = candles.slice(i, i + count)
          const aggregatedCandle = mergeFootPrintCandles(candleSubset, targetInterval)
          if (aggregatedCandle) {
            aggregatedCandles.push(aggregatedCandle)
          }
        }
      }

      if (aggregatedCandles.length > 0) {
        await this.databaseService.batchSaveFootPrintCandles(aggregatedCandles)
      }
    }
  }

  // Ensure mergeFootPrintCandles function exists and correctly aggregates the candleSubset into a single candle
  // Ensure alignsWithTargetInterval function is correctly implemented as shown previously

  private processNewTrades(symbol: string, isBuyerMaker: boolean, positionSize: numberInString, price: numberInString) {
    if (!this.didFinishConnectingWS) {
      return
    }

    const aggr = this.getOrderFlowAggregator(symbol, this.BASE_INTERVAL)
    aggr.processNewTrades(isBuyerMaker, Number(positionSize), Number(price))
  }

  private async persistCandlesToStorage(symbol: string, interval: string) {
    const aggr = this.getOrderFlowAggregator(symbol, interval)

    const queuedCandles = aggr.getQueuedCandles()
    if (queuedCandles.length === 0) {
      return
    }

    this.logger.log(
      'Saving batch of candles',
      queuedCandles.map((c) => c.uuid)
    )

    const savedUUIDs = await this.databaseService.batchSaveFootPrintCandles([...queuedCandles])

    // Filter out successfully saved candles
    aggr.markSavedCandles(savedUUIDs)
    aggr.pruneCandleQueue()
  }
}
