/* eslint-disable indent */
import { INTERVALS } from '@shared/utils/intervals'
import { IsEnum, IsString } from 'class-validator'

export class CandleBySymbolAndIntervalDto {
  @IsString()
  exchange: string

  @IsString()
  symbol: string

  @IsEnum(INTERVALS)
  interval: INTERVALS
}
