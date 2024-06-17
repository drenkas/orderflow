/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-empty-function */
import { Injectable } from '@nestjs/common'
import { Observable, Subject } from 'rxjs'
import { DefaultLogger, WebsocketClient, WsMessageAggTradeRaw } from 'binance'
import { ExchangeAPI, getExchangeLayer } from '@tsquant/exchangeapi'

/** Disable almost all internal logging from the binance ws lib */
const logger = {
  ...DefaultLogger,
  silly: (..._params) => {},
  debug: (..._params) => {},
  notice: (..._params) => {},
  info: (..._params) => {}
}

@Injectable()
export class BinanceWebSocketService {
  private ws: WebsocketClient
  private exchangeAPI: ExchangeAPI
  private tradeUpdates$: Subject<WsMessageAggTradeRaw> = new Subject()
  private reconnect$: Subject<string> = new Subject()
  private connected$: Subject<string> = new Subject()

  constructor() {
    this.initWebSocket()
  }

  get reconnected(): Observable<string> {
    return this.reconnect$.asObservable()
  }

  get connected(): Observable<string> {
    return this.connected$.asObservable()
  }

  get tradeUpdates(): Observable<WsMessageAggTradeRaw> {
    return this.tradeUpdates$.asObservable()
  }

  private initWebSocket(): void {
    this.ws = new WebsocketClient({ pongTimeout: 1000 * 30 }, logger)
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
      this.reconnect$.next(data.wsKey)
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
