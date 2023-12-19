import { Injectable } from '@nestjs/common'
import { Observable, Subject } from 'rxjs'
import { WebsocketClient, WsMessageAggTradeRaw } from 'binance'
import { ExchangeAPI, getExchangeLayer } from '@tsquant/exchangeapi'

@Injectable()
export class BinanceWebSocketService {
  private ws: WebsocketClient
  private exchangeAPI: ExchangeAPI
  private tradeUpdates$: Subject<WsMessageAggTradeRaw> = new Subject()
  private connected$: Subject<string> = new Subject()

  constructor() {
    this.initWebSocket()
  }

  get connected(): Observable<string> {
    return this.connected$.asObservable()
  }

  get tradeUpdates(): Observable<WsMessageAggTradeRaw> {
    return this.tradeUpdates$.asObservable()
  }

  private initWebSocket(): void {
    this.ws = new WebsocketClient({})
    this.exchangeAPI = getExchangeLayer({
      accountId: 'doesntMatter',
      exchange: 'paper_binance',
      expectedMarginMode: 'CROSS',
      quoteBalanceAsset: 'USDT'
    })

    // Ensures exchangeAPI is refreshed
    this.exchangeAPI.initState()

    this.ws.on('message', async (message: WsMessageAggTradeRaw) => {
      const roundedPrice = await this.exchangeAPI.getRoundedAssetPrice(message.s, Number(message.p))
      this.tradeUpdates$.next({
        ...message,
        p: roundedPrice
      })
    })

    this.ws.on('open', (event) => {
      console.log('connection opened:', event.wsKey, event.ws.target.url)
      this.connected$.next(event.wsKey)
    })

    this.ws.on('reconnecting', (data) => {
      console.log('ws automatically reconnecting.... ', data?.wsKey)
    })

    this.ws.on('reconnected', (data) => {
      console.log('ws has reconnected ', data?.wsKey)
    })

    this.ws.on('error', (data) => {
      console.log('ws saw error ', data?.wsKey)
    })
  }

  public subscribeToTrades(symbol: string, market: 'spot' | 'usdm' | 'coinm'): any {
    const response = this.ws.subscribeAggregateTrades(symbol, market)
    return response
  }
}
