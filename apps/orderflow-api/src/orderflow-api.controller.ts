import { Controller, Get, Param, ValidationPipe } from '@nestjs/common'
import { CandleBySymbolAndIntervalDto } from '@orderflow-api/orderflow-api.dto'
import { ApiService } from '@orderflow-api/orderflow-api.service'

@Controller('candles')
export class ApiController {
  constructor(private readonly apiService: ApiService) {}

  @Get(':exchange/:symbol/:type')
  async getCandlesBySymbol(@Param(new ValidationPipe()) params: CandleBySymbolAndIntervalDto): Promise<any> {
    return await this.apiService.getCandlesBySymbol(params.exchange, params.symbol, params.interval)
  }
}
