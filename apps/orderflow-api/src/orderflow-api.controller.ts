import { DatabaseService } from '@database'
import { Controller, Get, Param, ValidationPipe } from '@nestjs/common'
import { CandleBySymbolAndIntervalDto } from '@orderflow-api/orderflow-api.dto'

@Controller('candles')
export class ApiController {
  constructor(private readonly databaseService: DatabaseService) {}

  @Get(':exchange/:symbol/:type')
  async getCandlesBySymbol(@Param(new ValidationPipe()) params: CandleBySymbolAndIntervalDto): Promise<any> {
    return await this.databaseService.getCandles(params.exchange, params.symbol, params.interval)
  }
}
