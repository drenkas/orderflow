/* eslint-disable indent */
import { INTERVALS } from '@orderflow-api/constants.ts'
import { IsString, IsEnum } from 'class-validator'

export class CandleBySymbolAndIntervalDto {
  @IsString()
  exchange: string

  @IsString()
  symbol: string

  @IsEnum(INTERVALS)
  interval: INTERVALS
}
