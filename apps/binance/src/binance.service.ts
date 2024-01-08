import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { DatabaseService } from '@database/database.service'
import { numberInString, WsMessageAggTradeRaw } from 'binance'
import { BinanceWebSocketService } from 'apps/binance/src/BinanceWebsocketService'
import { getMsForInterval } from '@orderflow/utils/date'
import { OrderFlowAggregator } from '@orderflow/utils/orderFlowAggregator'

@Injectable()
export class BinanceService {
  private logger: Logger = new Logger(BinanceService.name)
  private symbols: string[] = ['BTCUSDT']
  private readonly BASE_INTERVAL = '1m'

  private expectedConnections: Map<string, Date> = new Map()
  private openConnections: Map<string, Date> = new Map()
  private wsKeyContextStore: Record<string, { symbol: string }> = {}
  private didFinishConnectingWS: boolean = false

  private aggregators: { [symbol: string]: OrderFlowAggregator } = {}

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly binanceWsService: BinanceWebSocketService
  ) {}

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
      const intervalSizeMs = getMsForInterval(interval)

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
      }
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async handlePrune() {
    await this.databaseService.pruneOldData()
  }

  private processNewTrades(
    symbol: string,
    isBuyerMaker: boolean,
    positionSize: numberInString,
    price: numberInString
  ) {
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
