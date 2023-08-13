import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { IFootPrintCandle } from 'src/types'
import { FootPrintCandle } from '@database/entity/footprint_candle.entity'

@Injectable()
export class DatabaseService {
  constructor(
    @InjectRepository(FootPrintCandle)
    private footprintCandleRepository: Repository<FootPrintCandle>
  ) {}

  async saveFootPrintCandle(candle: Omit<IFootPrintCandle, 'id'>): Promise<boolean> {
    try {
      await this.footprintCandleRepository.save(candle)
      return true
    } catch (error) {
      console.error('Error bulk inserting FootPrintCandles:', error)
      return false
    }
  }
}
