import { numberInString } from 'binance'

export interface TradeData {
  e: 'trade';
  E: number;
  s: string;
  t: number;
  p: numberInString;
  q: numberInString;
  b: number;
  a: number;
  T: number;
  m: boolean;
  M: boolean;
}
