import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { IFootPrintCandle } from '@orderflow/dto/orderflow.dto'
import { FootPrintCandle } from '@database/entity/footprint_candle.entity'
import { intervalMap } from '@orderflow-api/constants.ts'

@Injectable()
export class DatabaseService {
  constructor(
    @InjectRepository(FootPrintCandle)
    private footprintCandleRepository: Repository<FootPrintCandle>
  ) {}

  async batchSaveFootPrintCandles(candles: IFootPrintCandle[]): Promise<string[]> {
    try {
      // Clone and clean each candle before saving
      const cleanedCandles = candles.map(candle => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { uuid, ...cleanedCandle } = candle // Remove the id
        return cleanedCandle
      })

      await this.footprintCandleRepository.save(cleanedCandles)

      // Return the ids of successfully saved candles
      return candles.map(candle => candle.uuid)
    } catch (error) {
      console.error('Error bulk inserting FootPrintCandles:', error)
      return [] // Returning an empty array or handle differently based on your application's needs
    }
  }

  async getCandles(exchange: string, symbol: string, interval: string): Promise<any[]> {
    const intervalMinutes = intervalMap[interval]
    const groupingColumn = `DATE_TRUNC('minute', timestamp) - INTERVAL '1 minute' * (EXTRACT(MINUTE FROM timestamp) % ${intervalMinutes})`

    const query = this.footprintCandleRepository
      .createQueryBuilder('candle')
      .select([
        `MIN(candle.timestamp) as timestamp`,
        `MAX(candle.high) as high`,
        `MIN(candle.low) as low`,
        `SUM(candle.delta) as delta`,
        `SUM(candle.volume) as volume`,
        `candle.symbol as symbol`,
        `candle.exchange as exchange`,
        `SUM(candle.aggressiveBid) as "aggressiveBid"`,
        `SUM(candle.aggressiveAsk) as "aggressiveAsk"`
        // TODO: Aggregate bid and ask columns
      ])
      .where('candle.exchange = :exchange', { exchange })
      .andWhere('candle.symbol = :symbol', { symbol })
      .groupBy(groupingColumn)
      .addGroupBy('candle.symbol')
      .addGroupBy('candle.exchange')
      .orderBy('timestamp', 'ASC')
    try {
      return await query.getRawMany()
    } catch (error) {
      console.error('Error fetching aggregated candles:', error)
      throw error
    }
  }
  async pruneOldData(): Promise<void> {
    try {
      const TEN_DAYS_AGO = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) // 10 days ago

      await this.footprintCandleRepository.query(
        `
        DELETE FROM footprint_candle
        WHERE timestamp < $1
      `,
        [TEN_DAYS_AGO]
      )
    } catch (err) {
      console.error('Failed to prune old data:', err)
    }
  }
}
