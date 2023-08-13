export interface IFootPrintCandle {
  timestamp: string
  symbol: string
  delta: number
  volume: number
  high: number
  low: number
  bid: IPriceVolume
  ask: IPriceVolume
}

interface IPriceVolume {
  [price: string]: number;
}
