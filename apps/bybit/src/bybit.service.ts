import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { DatabaseService } from '@database/database.service'
import * as crypto from 'crypto'
import { BybitWebSocketService } from 'apps/bybit/src/BybitWebsocketService'
import { TradeData } from 'apps/bybit/src/websocket.responses'
import { IFootPrintCandle } from '@orderflow/dto/orderflow.dto'
import { createFormattedDate, getStartOfMinute } from '@orderflow/utils/date'

@Injectable()
export class ByBitService {
  private logger: Logger
  private activeCandles: IFootPrintCandle[] = []
  private closedCandles: IFootPrintCandle[] = []
  constructor(private readonly databaseService: DatabaseService, private readonly bybitWsService: BybitWebSocketService) {
    this.logger = new Logger(ByBitService.name)
  }

  async onModuleInit() {
    const topics: string[] = ['publicTrade.BTCUSDT']
    this.bybitWsService.subscribeToTopics(topics, 'linear')
    this.logger.log('subscribing to WS')

    this.createNewCandle()

    this.bybitWsService.tradeUpdates.subscribe((trades: TradeData[]) => {
      for (let i = 0; i < trades.length; i++) {
        this.updateLastCandle(trades[i].S, trades[i].v, trades[i].p, trades[i].L)
      }
    })
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async processCandles() {
    this.closeLastCandle()
    this.createNewCandle()
    await this.persistCandlesToStorage()
  }

  get lastCandle(): IFootPrintCandle {
    return this.activeCandles[this.activeCandles.length - 1]
  }

  private updateLastCandle(side: string, positionSize: string, price: string, direction: string) {
    if (!this.lastCandle) return

    const lastCandle = this.lastCandle

    const volume = parseFloat(positionSize)

    // Update volume
    lastCandle.volume += volume

    // Determine which side (bid/ask) and delta direction based on the side
    const targetSide = side === 'Buy' ? 'bid' : 'ask'
    const deltaChange = side === 'Buy' ? volume : -volume

    // Update delta
    lastCandle.volumeDelta += deltaChange

    // Update or initialize the bid/ask price volume
    lastCandle[targetSide][price] = (lastCandle[targetSide][price] || 0) + volume

    // Update aggressiveBid and aggressiveAsk based on tick direction
    if (targetSide === 'bid' && direction === 'PlusTick') {
      lastCandle.aggressiveBid = (lastCandle.aggressiveBid || 0) + volume
    } else if (targetSide === 'ask' && direction !== 'PlusTick') {
      // Assuming any non PlusTick is a MinusTick
      lastCandle.aggressiveAsk = (lastCandle.aggressiveAsk || 0) + volume
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
      exchange: 'bybit',
      interval: '1m',
      aggressiveBid: 0,
      aggressiveAsk: 0,
      volumeDelta: 0,
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
