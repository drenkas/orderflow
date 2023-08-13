import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { FootPrintCandle } from '@database/entity/footprint_candle.entity'

@Injectable()
export class DatabaseService {
  constructor(
    @InjectRepository(FootPrintCandle)
    private footprintCandleRepository: Repository<FootPrintCandle>
  ) {}

  async saveFootPrintCandle(candle: FootPrintCandle): Promise<void> {
    try {
      await this.footprintCandleRepository.save(candle)
    } catch (error) {
      console.error('Error bulk inserting FootPrintCandles:', error)
    }
  }
}
