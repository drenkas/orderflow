export interface IFootPrintCandle {
  timestamp: string
  symbol: string
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
