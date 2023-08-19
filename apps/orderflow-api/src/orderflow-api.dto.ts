/* eslint-disable indent */
import { Exchange } from '@orderflow-service/constants/exchanges'
import { INTERVALS } from '@orderflow-api/constants.ts'
import { IsString, IsEnum } from 'class-validator'

export class CandleBySymbolAndIntervalDto {
  @IsString()
  exchange: Exchange

  @IsString()
  symbol: string

  @IsEnum(INTERVALS)
  interval: INTERVALS
}
