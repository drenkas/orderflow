import { Injectable } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { BybitWebSocketService } from 'src/bybit/BybitWebsocketService'
import { TradeData } from 'src/bybit/websocket.responses'
import { IFootPrintCandle } from 'src/types'

@Injectable()
export class ByBitService {
  private activeCandles: IFootPrintCandle[] = []
  private closedCandles: IFootPrintCandle[] = []
  constructor(private readonly bybitWsService: BybitWebSocketService) {}

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
    this.activeCandles.push({
      timestamp: new Date().toISOString(),
      delta: 0,
      volume: 0,
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
}
