import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { DatabaseService } from '@database/database.service'
import { numberInString, WsMessageAggTradeRaw } from 'binance'
import * as crypto from 'crypto'
import { BinanceWebSocketService } from 'apps/binance/src/BinanceWebsocketService'
import { IFootPrintCandle } from '@orderflow/dto/orderflow.dto'
import { createFormattedDate, getStartOfMinute } from '@orderflow/utils/date'

@Injectable()
export class BinanceService {
  private logger: Logger = new Logger(BinanceService.name)
  private symbols: string[] = ['BTCUSDT']

  private expectedConnections: Map<string, Date> = new Map()
  private openConnections: Map<string, Date> = new Map()
  private wsKeyContextStore: Record<string, { symbol: string }> = {}
  private didFinishConnectingWS: boolean = false

  private activeCandles: IFootPrintCandle[] = []
  private closedCandles: IFootPrintCandle[] = []

  constructor(private readonly databaseService: DatabaseService, private readonly binanceWsService: BinanceWebSocketService) {}

  async onModuleInit() {
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
      this.updateLastCandle(trade.m, trade.q, trade.p)
    })
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async processCandles() {
    if (this.didFinishConnectingWS) {
      this.closeLastCandle()
      this.createNewCandle()
      await this.persistCandlesToStorage()
    }
  }

  get lastCandle(): IFootPrintCandle {
    return this.activeCandles[this.activeCandles.length - 1]
  }

  private updateLastCandle(isBuyerMM: boolean, positionSize: numberInString, price: numberInString) {
    if (!this.didFinishConnectingWS || !this.lastCandle) return

    const lastCandle = this.lastCandle

    const volume = Number(positionSize)

    // Update volume
    lastCandle.volume += volume

    // Determine which side (bid/ask) and delta direction based on isBuyerMM
    const targetSide = isBuyerMM ? 'ask' : 'bid'
    const deltaChange = isBuyerMM ? -volume : volume

    // Update delta
    lastCandle.delta += deltaChange

    // Update or initialize the bid/ask price volume
    lastCandle[targetSide][price] = (lastCandle[targetSide][price] || 0) + volume

    // Update aggressiveBid and aggressiveAsk based on isBuyerMM
    if (isBuyerMM) {
      lastCandle.aggressiveAsk += volume
    } else {
      lastCandle.aggressiveBid += volume
    }

    // Update high and low
    lastCandle.high = lastCandle.high ? Math.max(lastCandle.high, Number(price)) : Number(price)
    lastCandle.low = lastCandle.low ? Math.min(lastCandle.low, Number(price)) : Number(price)
  }

  private createNewCandle() {
    const now = getStartOfMinute()
    const formattedDate = createFormattedDate(now)

    this.logger.log(`Creating new candle at ${formattedDate}.`)

    this.activeCandles.push({
      id: crypto.randomUUID(),
      timestamp: now.toISOString(),
      symbol: 'BTCUSDT',
      exchange: 'binance',
      interval: '1m',
      aggressiveBid: 0,
      aggressiveAsk: 0,
      delta: 0,
      volume: 0,
      high: null,
      low: null,
      bid: {},
      ask: {}
    } as IFootPrintCandle)
  }

  private closeLastCandle() {
    if (this.activeCandles.length > 0) {
      this.logger.log('closing candle')
      const candleToClose = this.activeCandles.pop()
      this.closedCandles.push(candleToClose)
    }
  }

  private async persistCandlesToStorage() {
    const successfulIds: string[] = []

    for (let i = 0; i < this.closedCandles.length; i++) {
      this.logger.log('Saving Candle', this.closedCandles[i].id, this.closedCandles[i].timestamp)
      const isSaved = await this.databaseService.saveFootPrintCandle(this.closedCandles[i])
      if (isSaved) {
        successfulIds.push(this.closedCandles[i].id)
      }
    }

    this.closedCandles = this.closedCandles.filter((candle) => !successfulIds.includes(candle.id))
  }
}
