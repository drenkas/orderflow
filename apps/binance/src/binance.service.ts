import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { intervalMap } from '@api/constants'
import { DatabaseService } from '@database/database.service'
import { isMultipleOf } from '@orderflow/utils/math'
import { OrderFlowAggregator } from '@orderflow/utils/orderFlowAggregator'
import { mergeFootPrintCandles } from '@orderflow/utils/orderFlowUtil'
import { Exchange, KlineIntervalMs } from '@tsquant/exchangeapi/dist/lib/constants'
import { INTERVALS } from '@tsquant/exchangeapi/dist/lib/constants/candles'
import { LastStoredSymbolIntervalTimestampsDictionary } from '@tsquant/exchangeapi/dist/lib/types/candles.types'
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

  private lastTimestamps: LastStoredSymbolIntervalTimestampsDictionary = {}

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

      const maxRowsInMemory = 600
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

        const closeDate = new Date()
        closeDate.setMinutes(closeDate.getMinutes() + 1, 0, 0)
        const closeMinute: number = closeDate.getMinutes()
        const closeTimeMS: number = closeDate.getTime()
        const isCloseMinuteMultipleOfFive: boolean = isMinuteMultipleOfFive(closeMinute)

        if (isCloseMinuteMultipleOfFive) {
          for (const interval of this.LARGER_AGGREGATION_INTERVALS) {
            await this.updateLastTimestamps(symbol, interval)
            const lastTimestamp = this.lastTimestamps[symbol][interval]

            if (lastTimestamp && closeTimeMS === lastTimestamp + KlineIntervalMs[interval]) {
              await this.processLargerInterval(symbol, interval, closeDate, lastTimestamp)
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

  async updateLastTimestamps(symbol: string, interval: INTERVALS) {
    if (!this.lastTimestamps[symbol]) {
      this.lastTimestamps[symbol] = {}
    }

    if (!this.lastTimestamps[symbol][interval]) {
      const resultMap = await this.databaseService.getLastTimestamp(Exchange.BINANCE, symbol)
      if (resultMap[symbol]?.[interval]) {
        this.lastTimestamps[symbol][interval] = resultMap[symbol][interval]
      }
    }
  }

  async processLargerInterval(symbol: string, interval: INTERVALS, closeDate: Date, lastTimestamp: number) {
    const candleStartDate = new Date(lastTimestamp)

    const candles = await this.databaseService.getCandles(Exchange.BINANCE, symbol, interval, candleStartDate, closeDate)
    const requiredCandlesLength: number = intervalMap[interval]

    if (candles?.length === requiredCandlesLength) {
      const newCandle = mergeFootPrintCandles(candles, interval)
      if (newCandle) {
        await this.databaseService.batchSaveFootPrintCandles([newCandle])
      }
    }
  }

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
