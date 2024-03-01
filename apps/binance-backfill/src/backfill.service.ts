import { HttpService } from '@nestjs/axios'
import { INestApplication, Injectable, Logger } from '@nestjs/common'
import { parse } from 'csv-parse/sync'
import * as JSZip from 'jszip'
import { firstValueFrom } from 'rxjs'
import { DatabaseService } from '@database'
import { IAggregatedTrade } from '@orderflow/dto/binanceData.dto'
import { IFootPrintClosedCandle } from '@orderflow/dto/orderflow.dto'
import { calculateStartDate } from '@orderflow/utils/date'
import { OrderFlowAggregator } from '@orderflow/utils/orderFlowAggregator'
import { CACHE_LIMIT, Exchange, INTERVALS, KlineIntervalMs } from '@tsquant/exchangeapi/dist/lib/constants'

@Injectable()
export class BackfillService {
  private readonly baseUrl = 'https://data.binance.vision/?prefix=data/futures/um/daily/aggTrades'
  private readonly BASE_INTERVAL = INTERVALS.ONE_MINUTE
  private currTestTime: Date = new Date()

  protected symbols: string[] = process.env.SYMBOLS ? process.env.SYMBOLS.split(',') : ['BTCUSDT']

  private logger: Logger = new Logger(BackfillService.name)

  private aggregators: { [symbol: string]: OrderFlowAggregator } = {}
  private candles: { [key: string]: IFootPrintClosedCandle[] } = {
    [INTERVALS.ONE_MINUTE]: [],
    [INTERVALS.FIVE_MINUTES]: [],
    [INTERVALS.FIFTEEN_MINUTES]: [],
    [INTERVALS.THIRTY_MINUTES]: [],
    [INTERVALS.ONE_HOUR]: [],
    [INTERVALS.TWO_HOURS]: [],
    [INTERVALS.FOUR_HOURS]: [],
    [INTERVALS.SIX_HOURS]: [],
    [INTERVALS.TWELVE_HOURS]: [],
    [INTERVALS.ONE_DAY]: [],
    [INTERVALS.ONE_WEEK]: [],
    [INTERVALS.ONE_MONTH]: []
  }

  constructor(private readonly app: INestApplication, private readonly databaseService: DatabaseService, private readonly httpService: HttpService) {}

  async onModuleInit() {
    this.logger.log('start backfilling')

    const symbol: string = this.symbols[0]
    const maxRowsInMemory = CACHE_LIMIT
    Object.keys(this.candles).forEach((interval: INTERVALS) => {
      const intervalSizeMs: number = KlineIntervalMs[interval]
      this.aggregators[symbol] = new OrderFlowAggregator(Exchange.BINANCE, symbol, interval, intervalSizeMs, {
        maxCacheInMemory: maxRowsInMemory
      })
    })

    await this.downloadAndProcessCsvFiles(symbol)
    // await this.saveData(symbol)

    await this.app.close()
  }

  private async triggerCandleClose(): Promise<void> {
    //
  }

  private async downloadAndProcessCsvFiles(symbol: string) {
    const backfillStartAt: string = process.env.BACKFILL_START_AT as string
    const startDate = calculateStartDate(backfillStartAt)
    const currentDate = new Date(startDate)
    this.currTestTime = new Date(startDate)

    while (currentDate <= new Date()) {
      const dateString = currentDate.toISOString().split('T')[0]
      const fileUrl = `${this.baseUrl}/${symbol}/${symbol}-metrics-${dateString}.zip`

      try {
        const response: any = await firstValueFrom(
          this.httpService.get(fileUrl, {
            responseType: 'arraybuffer'
          })
        )

        const zip = await JSZip.loadAsync(response.data)
        const csvFileName: string = Object.keys(zip.files)[0]
        const csvFile: string = await zip.files[csvFileName].async('string')

        const trades = parse(csvFile, {
          columns: true,
          skip_empty_lines: true
        })

        trades.forEach((trade: IAggregatedTrade) => {
          // Convert transactTime to a Date object
          const tradeTime = new Date(trade.transactTime)

          // Check if the tradeTime is in the next minute or later compared to currTestTime
          if (tradeTime >= new Date(this.currTestTime.getTime() + 60000)) {
            // Find the start of the minute for the trade time
            const newCurrTestTime = new Date(tradeTime)
            newCurrTestTime.setSeconds(0, 0) // Set seconds and milliseconds to 0 to get the start of the minute

            // Update currTestTime to the start of the new minute
            this.currTestTime = newCurrTestTime

            // Call the method for closing the candle
            this.triggerCandleClose()
          }

          // Process the trade as needed
        })

        console.log(`Downloaded and parsed file for ${dateString}`)
      } catch (error) {
        console.error(`Failed to download or process the file for ${dateString}:`, error)
      }

      currentDate.setDate(currentDate.getDate() + 1)
    }
  }
}
