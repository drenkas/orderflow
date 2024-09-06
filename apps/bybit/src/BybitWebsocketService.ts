import { Injectable } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { TradeData, TradeResponse } from './websocket.responses';
import { CategoryV5, WebsocketClient } from 'bybit-api';

@Injectable()
export class BybitWebSocketService {
  private ws: WebsocketClient;
  private tradeUpdates$: Subject<TradeData[]> = new Subject();
  private reconnect$: Subject<string> = new Subject();
  private connected$: Subject<string> = new Subject();

  constructor() {
    this.initWebSocket();
  }

  get tradeUpdates(): Observable<TradeData[]> {
    return this.tradeUpdates$.asObservable();
  }

  private initWebSocket(): void {
    this.ws = new WebsocketClient({ market: 'v5' });

    this.ws.on('update', (response: TradeResponse) => {
      if (response.topic.startsWith('publicTrade')) {
        this.tradeUpdates$.next(response.data as TradeData[]);
      }
    });

    this.ws.on('open', (event) => {
      console.log('connection opened:', event.wsKey, event.ws.target.url);
      this.connected$.next(event.wsKey);
    });

    this.ws.on('reconnect', (data) => {
      console.log('ws automatically reconnecting.... ', data?.wsKey);
    });

    this.ws.on('reconnected', (data) => {
      console.log('ws has reconnected ', data?.wsKey);
      this.reconnect$.next(data.wsKey);
    });

    this.ws.on('error', (data) => {
      console.log('ws saw error ', data?.wsKey);
    });
  }

  public subscribeToTopics(topics: string[], category: string): void {
    this.ws.subscribeV5(topics, category as CategoryV5);
  }
}
