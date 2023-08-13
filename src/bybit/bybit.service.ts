import { Injectable } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { DatabaseService } from '@database/database.service'
import { BybitWebSocketService } from 'src/bybit/BybitWebsocketService'
import { TradeData } from 'src/bybit/websocket.responses'
import { Exchange } from 'src/constants/exchanges'
import { IFootPrintCandle } from 'src/types'

@Injectable()
export class ByBitService {
  private activeCandles: IFootPrintCandle[] = []
  private closedCandles: IFootPrintCandle[] = []
  constructor(private readonly databaseService: DatabaseService, private readonly bybitWsService: BybitWebSocketService) {}

  async onModuleInit() {
    const topics: string[] = ['publicTrade.BTCUSDT']
    this.bybitWsService.subscribeToTopics(topics, 'linear')

    this.createNewCandle()

    this.bybitWsService.tradeUpdates.subscribe((trades: TradeData[]) => {
      for (let i = 0; i < trades.length; i++) {
        this.updateLastCandle(trades[i].S, trades[i].v, trades[i].p)
      }
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

  private updateLastCandle(side: string, positionSize: string, price: string) {
    if (!this.lastCandle) return

    const lastCandle = this.lastCandle

    const volume = parseFloat(positionSize)

    // Update volume
    lastCandle.volume += volume

    // Determine which side (bid/ask) and delta direction based on the side
    const targetSide = side === 'Buy' ? 'bid' : 'ask'
    const deltaChange = side === 'Buy' ? volume : -volume

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
      id: crypto.randomUUID(),
      timestamp: now.toISOString(),
      symbol: 'BTCUSDT',
      exchange: Exchange.BINANCE,
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
    const successfulIds: string[] = []

    for (let i = 0; i < this.closedCandles.length; i++) {
      const isSaved = await this.databaseService.saveFootPrintCandle(this.closedCandles[i])
      if (isSaved) {
        successfulIds.push(this.closedCandles[i].id)
      }
    }

    this.closedCandles = this.closedCandles.filter((candle) => !successfulIds.includes(candle.id))
  }
}
