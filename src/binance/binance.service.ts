import { Injectable } from '@nestjs/common'
import { WsMessageAggTradeRaw, numberInString } from 'binance'
import { BinanceWebSocketService } from 'src/binance/BinanceWebsocketService'
import { IFootPrintCandle } from 'src/types'

@Injectable()
export class BinanceService {
  private candles: IFootPrintCandle[] = []
  constructor(private readonly binanceWsService: BinanceWebSocketService) {}

  async onModuleInit() {
    this.binanceWsService.subscribeToTrades('BTCUSDT', 'usdm')

    this.createNewCandle()

    this.binanceWsService.tradeUpdates.subscribe((trade: WsMessageAggTradeRaw) => {
      this.updateLastCandle(trade.m, trade.q, trade.p)
    })
  }

  get lastCandle(): IFootPrintCandle {
    return this.candles[this.candles.length - 1]
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
  }

  private createNewCandle() {
    this.candles.push({
      timestamp: new Date().toISOString(),
      delta: 0,
      volume: 0,
      bid: {},
      ask: {}
    } as IFootPrintCandle)
  }
}
