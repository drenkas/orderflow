export interface IFootPrintCandle {
  id: string
  timestamp: string
  interval: string
  symbol: string
  exchange: string
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
