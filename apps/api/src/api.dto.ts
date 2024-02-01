/* eslint-disable indent */
import { INTERVALS } from '@tsquant/exchangeapi/dist/lib/constants/candles'
import { IsEnum, IsString } from 'class-validator'

export class CandleBySymbolAndIntervalDto {
  @IsString()
  exchange: string

  @IsString()
  symbol: string

  @IsEnum(INTERVALS)
  interval: INTERVALS
}
