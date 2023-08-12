import { Injectable } from '@nestjs/common'
import { BybitWebSocketService } from 'src/bybit/BybitWebsocketService'
import { BinanceWebSocketService } from 'src/binance/BinanceWebsocketService'
import { TradeData } from 'src/bybit/websocket.responses'
import { INTERVALS } from 'src/constants/candlesticks.types'

export type VolumeData = {
  [interval: string]: { buy: number; sell: number }
}

export type VolumeStorage = {
  [symbol: string]: VolumeData
}

const intervals: string[] = [
  INTERVALS.FIVE_MINUTES,
  INTERVALS.FIFTEEN_MINUTES,
  INTERVALS.THIRTY_MINUTES,
  INTERVALS.ONE_HOUR,
  INTERVALS.FOUR_HOURS,
  INTERVALS.ONE_DAY
]

@Injectable()
export class AppService {
  private bybitVolume: VolumeStorage = {}
  private binanceVolume: VolumeStorage = {}

  constructor(private readonly bybitWsService: BybitWebSocketService, private readonly binanceWsService: BinanceWebSocketService) {}

  async onModuleInit() {
    const topics: string[] = ['publicTrade.BTCUSDT']
    this.bybitWsService.subscribeToTopics(topics, 'linear')

    this.binanceWsService.subscribeToTrades('BTCUSDT', 'usdm')

    this.bybitWsService.tradeUpdates.subscribe((trades: TradeData[]) => {
      for (let i = 0; i < trades.length; i++) {
        intervals.forEach((interval) => {
          this.bybitVolume[trades[i].s][interval][trades[i].S] += Number(trades[i].v)
        })
      }
    })

    this.binanceWsService.tradeUpdates.subscribe((trade) => {
      intervals.forEach((interval) => {
        const side: string = trade.m ? 'buy' : 'sell'
        this.binanceVolume[trade.s][interval][side] += Number(trade.q)
      })
    })
  }
}
