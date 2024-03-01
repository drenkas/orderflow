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
  private readonly BASE_SYMBOL = 'BTCUSDT'
  private readonly BASE_INTERVAL = INTERVALS.ONE_MINUTE
  private currTestTime: Date = new Date()
  private nextCandleTime: Date = new Date()

  protected symbols: string[] = process.env.SYMBOLS ? process.env.SYMBOLS.split(',') : [this.BASE_SYMBOL]

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

    const maxRowsInMemory = CACHE_LIMIT
    const intervalSizeMs: number = KlineIntervalMs[INTERVALS.ONE_MINUTE]
    this.aggregators[this.BASE_SYMBOL] = new OrderFlowAggregator(Exchange.BINANCE, this.BASE_SYMBOL, INTERVALS.ONE_MINUTE, intervalSizeMs, {
      maxCacheInMemory: maxRowsInMemory
    })

    await this.downloadAndProcessCsvFiles()
    // await this.saveData(symbol)

    await this.app.close()
  }

  private async triggerCandleClose(): Promise<void> {
    this.aggregators[this.BASE_SYMBOL].processCandleClosed()
    await this.persistCandlesToStorage()
  }

  private async persistCandlesToStorage() {
    const queuedCandles = this.aggregators[this.BASE_SYMBOL].getQueuedCandles()
    if (queuedCandles.length <= 500) {
      return
    }

    this.logger.log(
      'Saving batch of candles',
      queuedCandles.map((c) => c.uuid)
    )

    const savedUUIDs = await this.databaseService.batchSaveFootPrintCandles([...queuedCandles])

    // Filter out successfully saved candles
    this.aggregators[this.BASE_SYMBOL].markSavedCandles(savedUUIDs)
    this.aggregators[this.BASE_SYMBOL].pruneCandleQueue()
  }

  private async downloadAndProcessCsvFiles() {
    const backfillStartAt: string = process.env.BACKFILL_START_AT as string
    const startDate = new Date(new Date(calculateStartDate(backfillStartAt).setHours(0, 0, 0, 0))) // Start of period at 00:00
    const endDate = new Date(new Date(new Date().setDate(new Date().getDate() - 1)).setHours(0, 0, 0, 0)) // Start of previous day at 00:00
    let currentDate = new Date(startDate)
    this.currTestTime = new Date(startDate)
    this.nextCandleTime = new Date(this.currTestTime.getTime() + 60000)

    while (currentDate <= endDate) {
      const dateString = currentDate.toISOString().split('T')[0]
      const fileUrl = `${this.baseUrl}/${this.BASE_SYMBOL}/${this.BASE_SYMBOL}-metrics-${dateString}.zip`

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

        for (let i = 0; i < trades.length; i++) {
          const trade: IAggregatedTrade = trades[i]
          const tradeTime = new Date(trade.transactTime)

          if (tradeTime >= this.nextCandleTime) {
            this.currTestTime = new Date(this.nextCandleTime)
            this.nextCandleTime = new Date(this.nextCandleTime.getTime() + 60000)

            await this.triggerCandleClose()
          } else {
            this.aggregators[this.BASE_SYMBOL].processNewTrades(trade.isBuyerMaker, Number(trade.quantity), Number(trade.price))
          }
        }

        console.log(`Downloaded and parsed file for ${dateString}`)
      } catch (error) {
        console.error(`Failed to download or process the file for ${dateString}:`, error)
      }

      currentDate = new Date(currentDate.setDate(currentDate.getDate() + 1))
    }
  }
}
