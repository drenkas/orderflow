import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { DatabaseService } from '@database/database.service'
import { OrderFlowAggregator } from '@orderflow/utils/orderFlowAggregator'
import { Exchange, KlineIntervalMs } from '@tsquant/exchangeapi/dist/lib/constants'
import { INTERVALS } from '@tsquant/exchangeapi/dist/lib/constants/candles'
import { LastStoredSymbolIntervalTimestampsDictionary } from '@tsquant/exchangeapi/dist/lib/types/candles.types'
import { BinanceWebSocketService } from 'apps/binance/src/BinanceWebsocketService'
import { numberInString, WsMessageAggTradeRaw } from 'binance'
import { getStartOfMinute } from '@orderflow/utils/date'

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

        const currentDate = new Date()
        const currentMinute = currentDate.getMinutes()
        const startDate: Date = getStartOfMinute()
        const openTimeMS: number = startDate.getTime()
        const isMultipleOfFive = currentMinute % 5 === 0
        if (isMultipleOfFive) {
          for (const interval of this.LARGER_AGGREGATION_INTERVALS) {
            if (!this.lastTimestamps[symbol]) {
              this.lastTimestamps[symbol] = {}
            }
            if (!this.lastTimestamps[symbol][interval]) {
              const resultMap: LastStoredSymbolIntervalTimestampsDictionary = await this.databaseService.getLastTimestamp(Exchange.BINANCE, symbol)

              if (resultMap[symbol]?.[interval]) {
                this.lastTimestamps[symbol][interval] = resultMap[symbol][interval]
              }
            }

            if (this.lastTimestamps[symbol][interval]) {
              const nextExpectedCandleMS = this.lastTimestamps[symbol][interval] + KlineIntervalMs[interval]
              if (openTimeMS === nextExpectedCandleMS) {
                
              }
            } else {
              //
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
