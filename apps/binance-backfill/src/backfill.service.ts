import { INestApplication, Injectable } from '@nestjs/common'
import { firstValueFrom } from 'rxjs'
import { DatabaseService } from '@database'
import { IFootPrintClosedCandle } from '@orderflow/dto/orderflow.dto'
import { INTERVALS } from '@tsquant/exchangeapi/dist/lib/constants'
import { parse } from 'csv-parse/sync'
import * as JSZip from 'jszip'
import { calculateStartDate } from '@orderflow/utils/date'
import { IAggregatedTrade } from '@orderflow/dto/binanceData.dto'

@Injectable()
export class BackfillService {
  private readonly baseUrl = 'https://data.binance.vision/?prefix=data/futures/um/daily/aggTrades'

  private candles: { [key: string]: IFootPrintClosedCandle[] } = {
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

  public async startBackfilling(symbol: string): Promise<void> {
    console.log('start backfilling')
    await this.downloadAndTransformCsvFiles(symbol)
    await this.saveData(symbol)

    await this.app.close()
  }

  private async downloadAndTransformCsvFiles(symbol: string) {
    const backfillStartAt: string = process.env.BACKFILL_START_AT as string
    const startDate = calculateStartDate(backfillStartAt)
    const currentDate = new Date(startDate)

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
          //
        })

        console.log(`Downloaded and parsed file for ${dateString}`)
      } catch (error) {
        console.error(`Failed to download or process the file for ${dateString}:`, error)
      }

      currentDate.setDate(currentDate.getDate() + 1)
    }
  }
}
