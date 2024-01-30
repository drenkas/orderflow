/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { intervalMap } from '@api/constants'
import { FootPrintCandle } from '@database/entity/footprint_candle.entity'
import { CACHE_LIMIT } from '@orderflow/constants'
import { IFootPrintCandle } from '@orderflow/dto/orderflow.dto'
import { EXCHANGE_DATA_TYPES } from '@tsquant/exchangeapi/dist/lib/constants'
import { LastStoredSymbolIntervalTimestampsDictionary } from '@tsquant/exchangeapi/dist/lib/types'

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
        const cleanedCandle = {
          ...candle,
          uuid: undefined
        }

        delete cleanedCandle.uuid

        return cleanedCandle
      })

      // console.log(`saving data: `, JSON.stringify({ levels, cleanedCandles }, null, 2))

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

  async getTestCandles(): Promise<any[]> {
    const query = this.footprintCandleRepository.createQueryBuilder('candle').select('*').where('candle.id IN (1,2,3,4)')

    try {
      return await query.getRawMany()
    } catch (error) {
      console.error('Error getTestCandles', error)
      throw error
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
            PARTITION BY exchange, symbol, interval ORDER BY "openTime" DESC
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

  /** Fetch the last stored timestamp data to continue where we left off. Timestamp is the openTime for kLines */
  async getLastTimestamp(exchange: string, symbol?: string): Promise<LastStoredSymbolIntervalTimestampsDictionary> {
    try {
      const params = symbol ? [exchange, symbol] : [exchange]
      const query = `
      SELECT symbol, interval, MAX(openTime) as max_timestamp
      FROM footprint_candle
      WHERE exchange = $1${symbol ? ' AND symbol = $2' : ''}
      GROUP BY symbol, interval
    `

      const result = await this.footprintCandleRepository.query(query, params)
      const resultMap: LastStoredSymbolIntervalTimestampsDictionary = {}

      result.forEach((row) => {
        if (!resultMap[row.symbol]) {
          resultMap[row.symbol] = {}
        }
        resultMap[row.symbol][row.interval] = row.max_timestamp ? new Date(row.max_timestamp).getTime() : 0
      })

      return resultMap
    } catch (err) {
      this.logger.error('Failed to retrieve last timestamps:', err)
      return {}
    }
  }
}
