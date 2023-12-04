import * as crypto from 'crypto'
import { IFootPrintCandle, IFootPrintClosedCandle, IPriceLevelClosed } from '../dto/orderflow.dto'
import { getStartOfMinute } from './date'

export interface OrderFlowAggregatorConfig {
  // TODO: not implemented
  pricePrecisionDp: number
  // TODO: defines how many rows to keep in memory before pruning old rows (default is 600)
  maxCacheInMemory: number
  /** If one side has more than x% dominance, consider this an imbalance */
  // imbalanceThresholdPercent: number;
}

export class OrderFlowAggregator {
  exchange: string
  symbol: string
  interval: string
  intervalSizeMs: number

  config: OrderFlowAggregatorConfig

  /** Candle currently building (still open) */
  private activeCandle: IFootPrintCandle | undefined

  /** Queue of candles that may not yet have received the DB (closed) */
  private candleQueue: IFootPrintClosedCandle[] = []

  constructor(exchange: string, symbol: string, interval: string, intervalSizeMs: number, config?: Partial<OrderFlowAggregatorConfig>) {
    this.exchange = exchange
    this.symbol = symbol
    this.interval = interval
    this.intervalSizeMs = intervalSizeMs

    this.config = {
      pricePrecisionDp: 1,
      maxCacheInMemory: 600,
      ...config
    }
  }

  /** Get only candles that haven't been saved to DB yet */
  public getQueuedCandles(): IFootPrintClosedCandle[] {
    return this.getAllCandles().filter((candle) => !candle.didPersistToStore)
  }

  /** Get all candles, incl those already saved to DB */
  public getAllCandles(): IFootPrintClosedCandle[] {
    return this.candleQueue
  }

  /** Marks which candles have been saved to DB */
  public markSavedCandles(savedUUIDs: string[]) {
    for (const uuid in savedUUIDs) {
      const candle = this.getAllCandles().find((c) => c.uuid === uuid)
      candle.didPersistToStore = true
    }
  }

  /** Call to ensure candle queue is trimmed within max length (oldest are discarded first) */
  public pruneCandleQueue() {
    const MAX_QUEUE_LENGTH = this.config.maxCacheInMemory
    if (this.candleQueue.length <= MAX_QUEUE_LENGTH) {
      return
    }

    // Trim store to last x candles, based on config
    const rowsToTrim = this.candleQueue.length - MAX_QUEUE_LENGTH
    this.candleQueue.splice(0, rowsToTrim)
  }

  public retireActiveCandle(): void {
    const candle = this.activeCandle

    if (!candle) {
      return
    }

    const closedPriceLevels: { [price: number]: IPriceLevelClosed } = {}

    for (const levelPrice in candle.priceLevels) {
      const level = candle.priceLevels[levelPrice]
      const imbalancePercent = (level.volSumBid / level.volSumAsk) * 100
      closedPriceLevels[levelPrice] = { ...level, imbalancePercent }
    }

    const closedCandle: IFootPrintClosedCandle = {
      ...candle,
      priceLevels: closedPriceLevels,
      isClosed: true,
      didPersistToStore: false
    }

    this.candleQueue.push(closedCandle)
    delete this.activeCandle
  }

  public createNewCandle(exchange: string, symbol: string, interval: string, intervalSizeMs: number, startDate: Date = getStartOfMinute()) {
    const closeTimeMs = startDate.getTime() + intervalSizeMs - 1

    const candle: IFootPrintCandle = {
      uuid: crypto.randomUUID(),
      openTime: startDate.toISOString(),
      openTimeMs: startDate.getTime(),
      closeTime: new Date(closeTimeMs).toISOString(),
      closeTimeMs: closeTimeMs,
      symbol: symbol,
      exchange: exchange,
      interval: interval,
      aggressiveBid: 0,
      aggressiveAsk: 0,
      volume: 0,
      volumeDelta: 0,
      high: null,
      low: null,
      priceLevels: {},
      isClosed: false
    }

    this.activeCandle = candle
  }

  public processCandleClosed(newCandleStartDate?: Date) {
    this.retireActiveCandle()
    this.createNewCandle(this.exchange, this.symbol, this.interval, this.intervalSizeMs, newCandleStartDate)
  }

  public processNewTrades(isBuyerMaker: boolean, assetQty: number, price: number) {
    if (!this.activeCandle) {
      this.createNewCandle(this.exchange, this.symbol, this.interval, this.intervalSizeMs)
      return this.processNewTrades(isBuyerMaker, assetQty, price)
    }

    // const quoteVolume = assetQty * price;
    const volume = assetQty

    // TODO: asset qty or notional value or both?
    // https://t.me/c/1819709460/8295/17236
    this.activeCandle.volume += volume

    // Determine which side (bid/ask) and delta direction based on isBuyerMM
    const deltaChange = isBuyerMaker ? -volume : volume

    // Update delta
    this.activeCandle.volumeDelta += deltaChange

    // Initialise the price level, if it doesn't exist yet
    // TODO: do price step size rounding here
    if (!this.activeCandle.priceLevels[price]) {
      this.activeCandle.priceLevels[price] = {
        volSumAsk: 0,
        volSumBid: 0
      }
    }

    // If buyer is maker, buy is a limit order, seller is a market order (low ask), seller is aggressive ask
    if (isBuyerMaker) {
      this.activeCandle.aggressiveAsk += volume
      this.activeCandle.priceLevels[price].volSumAsk += volume
    } else {
      // Else, sell is a limit order, buyer is a market order (high bid), buyer is aggressive bid
      this.activeCandle.aggressiveBid += volume
      this.activeCandle.priceLevels[price].volSumBid += volume
    }

    // Update high and low
    this.activeCandle.high = this.activeCandle.high ? Math.max(this.activeCandle.high, Number(price)) : Number(price)
    this.activeCandle.low = this.activeCandle.low ? Math.min(this.activeCandle.low, Number(price)) : Number(price)
  }
}
