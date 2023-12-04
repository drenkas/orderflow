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

  private activeCandle: IFootPrintCandle
  private candleQueue: IFootPrintCandle[] = []

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
      this.processNewTrades(trade.m, trade.q, trade.p)
    })
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async processCandles() {
    if (this.didFinishConnectingWS) {
      this.retireActiveCandle()
      this.createNewCandle()
      await this.persistCandlesToStorage()
    }
  }

  private processNewTrades(isBuyerMM: boolean, positionSize: numberInString, price: numberInString) {
    if (!this.didFinishConnectingWS || !this.activeCandle) return

    const volume = Number(positionSize)

    // Update volume
    this.activeCandle.volume += volume

    // Determine which side (bid/ask) and delta direction based on isBuyerMM
    const targetSide = isBuyerMM ? 'ask' : 'bid'
    const deltaChange = isBuyerMM ? -volume : volume

    // Update delta
    this.activeCandle.delta += deltaChange

    // Update or initialize the bid/ask price volume
    this.activeCandle[targetSide][price] = (this.activeCandle[targetSide][price] || 0) + volume

    // Update aggressiveBid and aggressiveAsk based on isBuyerMM
    if (isBuyerMM) {
      this.activeCandle.aggressiveAsk += volume
    } else {
      this.activeCandle.aggressiveBid += volume
    }

    // Update high and low
    this.activeCandle.high = this.activeCandle.high ? Math.max(this.activeCandle.high, Number(price)) : Number(price)
    this.activeCandle.low = this.activeCandle.low ? Math.min(this.activeCandle.low, Number(price)) : Number(price)
  }

  private retireActiveCandle(): void {
    if (this.activeCandle) {
      this.logger.log('closing candle')
      this.candleQueue.push(this.activeCandle)
      this.activeCandle = null
    }
  }

  private createNewCandle() {
    const now = getStartOfMinute()
    const formattedDate = createFormattedDate(now)

    this.logger.log(`Creating new candle at ${formattedDate}.`)

    this.activeCandle = {
      uuid: crypto.randomUUID(),
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
    } as IFootPrintCandle
  }

  private async persistCandlesToStorage() {
    if (this.candleQueue.length === 0) return

    this.logger.log('Saving batch of candles', this.candleQueue.map(c => c.uuid))
    const savedUUIDs = await this.databaseService.batchSaveFootPrintCandles(this.candleQueue)

    // Filter out successfully saved candles
    this.candleQueue = this.candleQueue.filter(candle => !savedUUIDs.includes(candle.uuid))
  }
}
