export const CACHE_LIMIT = 600;

export enum Exchange {
  BINANCE = 'binance',
  BITMEX = 'bitmex',
  BYBIT = 'bybit'
}

export enum EXCHANGE_DATA_TYPES {
  STOCKS_CHART = 'stocks',
  SYMBOLS = 'symbols',
  KLINES = 'kline',
  FOOTPRINT_CANDLES = 'footprint_candle',
  OPEN_INTEREST = 'open_interest',
  VOLUME_RATIO = 'volume_ratio',
  LATEST_BIG_DEAL = 'latest_big_deal',
  FUNDING_RATE = 'funding_rate'
}
