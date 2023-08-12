import { Injectable } from '@nestjs/common'
import { Observable, Subject } from 'rxjs'
import { TradeData, TradeResponse } from 'src/bybit/websocket.responses'
import { CategoryV5, WebsocketClient } from 'bybit-api'

@Injectable()
export class BybitWebSocketService {
  private ws: WebsocketClient
  private tradeUpdates$: Subject<TradeData[]> = new Subject()

  constructor() {
    this.initWebSocket()
  }

  get tradeUpdates(): Observable<TradeData[]> {
    return this.tradeUpdates$.asObservable()
  }

  private initWebSocket(): void {
    this.ws = new WebsocketClient({ market: 'v5' })
    this.ws.on('update', (response: TradeResponse) => {
      if (response.topic.startsWith('publicTrade')) {
        this.tradeUpdates$.next(response.data as TradeData[])
      }
    })
  }

  public subscribeToTopics(topics: string[], category: string): void {
    this.ws.subscribeV5(topics, category as CategoryV5)
  }
}
