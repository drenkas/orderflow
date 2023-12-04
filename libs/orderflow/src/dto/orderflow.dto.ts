export interface IFootPrintCandle {
  uuid: string
  openTime: string
  interval: string
  symbol: string
  exchange: string
  aggressiveBid: number
  aggressiveAsk: number
  delta: number
  volume: number
  high: number
  low: number
  bid: IOrderRow
  ask: IOrderRow
}

interface IOrderRow {
  [price: string]: number;
}
