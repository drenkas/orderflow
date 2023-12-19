import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { FootPrintCandle } from '@database/entity/footprint_candle.entity'
import { intervalMap } from '@api/constants'
import { CACHE_LIMIT } from '@orderflow/constants'
import { IFootPrintCandle } from '@orderflow/dto/orderflow.dto'

@Injectable()
export class DatabaseService {
  private logger: Logger = new Logger(DatabaseService.name)

  constructor(
    @InjectRepository(FootPrintCandle)
    private footprintCandleRepository: Repository<FootPrintCandle>
  ) {}

  async batchSaveFootPrintCandles(candles: IFootPrintCandle[]): Promise<string[]> {
    try {
      // Clone and clean each candle before saving
      const cleanedCandles = candles.map((candle) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { uuid, ...cleanedCandle } = candle // Remove the id
        return cleanedCandle
      })

      await this.footprintCandleRepository.save(cleanedCandles)

      // Return the ids of successfully saved candles
      const saved = candles.map((candle) => candle.uuid)
      // console.log(`batch saved candles: `, saved)
      return saved
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
      await this.footprintCandleRepository.query(`
        WITH ranked_rows AS (
          SELECT id, ROW_NUMBER() OVER (
            PARTITION BY exchange, symbol, interval ORDER BY openTime DESC
          ) row_number
          FROM footprint_candle
        )
        DELETE FROM footprint_candle
        WHERE id IN (
          SELECT id FROM ranked_rows WHERE row_number > ${CACHE_LIMIT}
        )
      `)
    } catch (err) {
      this.logger.error('Failed to prune old data:', err)
    }
  }
}
