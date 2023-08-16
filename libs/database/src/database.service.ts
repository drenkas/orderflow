import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { IFootPrintCandle } from 'apps/orderflow-service/src/types'
import { FootPrintCandle } from '@database/entity/footprint_candle.entity'

@Injectable()
export class DatabaseService {
  constructor(
    @InjectRepository(FootPrintCandle)
    private footprintCandleRepository: Repository<FootPrintCandle>
  ) {}

  async saveFootPrintCandle(candle: IFootPrintCandle): Promise<boolean> {
    try {
      const cleanedCandle = { ...candle }
      delete cleanedCandle.id
      await this.footprintCandleRepository.save(cleanedCandle as Omit<IFootPrintCandle, 'id'>)
      return true
    } catch (error) {
      console.error('Error bulk inserting FootPrintCandles:', error)
      return false
    }
  }

  async getCandles(interval: '30m' | '1h' | '4h'): Promise<any[]> {
    const intervalMinutes = this.getIntervalInMinutes(interval)
    const groupingColumn = `DATE_TRUNC('minute', timestamp) - INTERVAL '1 minute' * (EXTRACT(MINUTE FROM timestamp) % ${intervalMinutes})`

    const query = this.footprintCandleRepository
      .createQueryBuilder('candle')
      .select([
        `MIN(candle.timestamp) as timestamp`,
        `MAX(candle.high) as high`,
        `MIN(candle.low) as low`,
        `SUM(candle.delta) as delta`,
        `SUM(candle.volume) as volume`,
        `candle.symbol`,
        `candle.exchange`,
        `SUM(candle.aggressiveBid) as aggressiveBid`,
        `SUM(candle.aggressiveAsk) as aggressiveAsk`
        // TODO: Aggregate bid and ask columns
      ])
      .groupBy(groupingColumn)
      .addGroupBy('candle.symbol')
      .addGroupBy('candle.exchange')
      .orderBy('timestamp', 'ASC')

    // NOTE: The aggregation for the bid and ask columns will require more
    // complex logic, perhaps involving subqueries or even raw SQL,
    // depending on the specifics of their data structures.

    try {
      return await query.getRawMany()
    } catch (error) {
      console.error('Error fetching aggregated candles:', error)
      throw error
    }
  }

  private getIntervalInMinutes(interval: '30m' | '1h' | '4h'): number {
    switch (interval) {
      case '30m':
        return 30
      case '1h':
        return 60
      case '4h':
        return 240
      default:
        throw new Error(`Invalid interval: ${interval}`)
    }
  }
}
