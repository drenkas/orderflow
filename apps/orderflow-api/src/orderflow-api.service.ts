import { Injectable } from '@nestjs/common'
import { DatabaseService } from '@database'
import { Exchange } from '@orderflow-service/constants/exchanges'

@Injectable()
export class ApiService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getCandles(exchange: Exchange, symbol: string, interval: string): Promise<any> {
    return await this.databaseService.getCandles(exchange, symbol, interval)
  }
}
