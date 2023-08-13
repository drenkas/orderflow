import { Injectable } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { DatabaseService } from '@database/database.service'
import { numberInString, WsMessageAggTradeRaw } from 'binance'
import { BinanceWebSocketService } from 'src/binance/BinanceWebsocketService'
import { IFootPrintCandle } from 'src/types'

@Injectable()
export class BinanceService {
  private activeCandles: IFootPrintCandle[] = []
  private closedCandles: IFootPrintCandle[] = []
  constructor(private readonly databaseService: DatabaseService, private readonly binanceWsService: BinanceWebSocketService) {}

  async onModuleInit() {
    this.binanceWsService.subscribeToTrades('BTCUSDT', 'usdm')

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

    // Update high and low
    lastCandle.high = lastCandle.high ? Math.max(lastCandle.high, Number(price)) : Number(price)
    lastCandle.low = lastCandle.low ? Math.min(lastCandle.low, Number(price)) : Number(price)
  }

  private createNewCandle() {
    const now = new Date()
    now.setSeconds(0, 0)

    this.activeCandles.push({
      timestamp: now.toISOString(),
      interval: '1m',
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
      const candleToClose = this.activeCandles.pop()
      this.closedCandles.push(candleToClose)
    }
  }

  private async persistCandlesToStorage() {
    if (this.closedCandles.length > 0) {
      for (let i = 0; i < this.closedCandles.length; i++) {
        await this.databaseService.saveFootPrintCandle(this.closeLastCandle[i])
      }
    }
  }
}
