/* eslint-disable indent */
import { Exchange } from '@orderflow-service/constants/exchanges'
import { IsString } from 'class-validator'

export class CandleBySymbolAndIntervalDto {
  @IsString()
  exchange: Exchange

  @IsString()
  symbol: string

  @IsString()
  interval: string
}
