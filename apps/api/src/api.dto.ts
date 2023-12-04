/* eslint-disable indent */
import { INTERVALS } from './constants'
import { IsString, IsEnum } from 'class-validator'

export class CandleBySymbolAndIntervalDto {
  @IsString()
  exchange: string

  @IsString()
  symbol: string

  @IsEnum(INTERVALS)
  interval: INTERVALS
}
