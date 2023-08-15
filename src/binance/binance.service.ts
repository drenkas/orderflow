import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { DatabaseService } from '@database/database.service'
import { numberInString, WsMessageAggTradeRaw } from 'binance'
import { BinanceWebSocketService } from 'src/binance/BinanceWebsocketService'
import { Exchange } from 'src/constants/exchanges'
import { IFootPrintCandle } from 'src/types'

@Injectable()
export class BinanceService {
  private logger: Logger
  private activeCandles: IFootPrintCandle[] = []
  private closedCandles: IFootPrintCandle[] = []
  constructor(private readonly databaseService: DatabaseService, private readonly binanceWsService: BinanceWebSocketService) {
    this.logger = new Logger(BinanceService.name)
  }

  async onModuleInit() {
    this.binanceWsService.subscribeToTrades('BTCUSDT', 'usdm')
    this.logger.log('subscribing to WS')

    this.createNewCandle()

    this.binanceWsService.tradeUpdates.subscribe((trade: WsMessageAggTradeRaw) => {
      this.updateLastCandle(trade.m, trade.q, trade.p)
    })
  }

  @Cron('* * * * *') // Every 1 minute
  async processCandles() {
    this.closeLastCandle()
    this.createNewCandle()
    await this.persistCandlesToStorage()
  }

  get lastCandle(): IFootPrintCandle {
    return this.activeCandles[this.activeCandles.length - 1]
  }

  private updateLastCandle(isBuyerMM: boolean, positionSize: numberInString, price: numberInString) {
    if (!this.lastCandle) return
    this.logger.log('updating candle')

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
    const now = new Date()
    now.setSeconds(0, 0)

    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

    const date = now.getDate()
    const month = months[now.getMonth()]
    const year = now.getFullYear()
    const hours = now.getHours().toString().padStart(2, '0')
    const minutes = now.getMinutes().toString().padStart(2, '0')
    const seconds = now.getSeconds().toString().padStart(2, '0')

    this.logger.log(`Creating new candle at ${date} ${month} ${year} ${hours}:${minutes}:${seconds}.`)

    this.activeCandles.push({
      id: crypto.randomUUID(),
      timestamp: now.toISOString(),
      symbol: 'BTCUSDT',
      exchange: Exchange.BINANCE,
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
