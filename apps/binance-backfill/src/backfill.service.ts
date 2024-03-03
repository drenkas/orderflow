import { HttpService } from '@nestjs/axios'
import { Injectable, Logger } from '@nestjs/common'
import { parse } from 'csv-parse/sync'
import * as JSZip from 'jszip'
import { firstValueFrom } from 'rxjs'
import { DatabaseService } from '@database'
import { CANDLE_BUILDER_RULES } from '@orderflow/constants'
import { IAggregatedTrade } from '@orderflow/dto/binanceData.dto'
import { IFootPrintClosedCandle } from '@orderflow/dto/orderflow.dto'
import { calculateCandlesNeeded } from '@orderflow/utils/candles'
import { calculateStartDate } from '@orderflow/utils/date'
import { OrderFlowAggregator } from '@orderflow/utils/orderFlowAggregator'
import { mergeFootPrintCandles } from '@orderflow/utils/orderFlowUtil'
import { CACHE_LIMIT, Exchange, INTERVALS, KlineIntervalMs, KlineIntervalTimes } from '@tsquant/exchangeapi/dist/lib/constants'

@Injectable()
export class BackfillService {
  private readonly baseUrl = 'https://data.binance.vision/data/futures/um/daily/aggTrades'
  private readonly exchange: Exchange = Exchange.BINANCE
  private readonly BASE_SYMBOL = 'BTCUSDT'
  private readonly BASE_INTERVAL = INTERVALS.ONE_MINUTE
  private currTestTime: Date = new Date()
  private nextMinuteCandleClose: Date = new Date()

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

  constructor(private readonly databaseService: DatabaseService, private readonly httpService: HttpService) {}

  async onModuleInit() {
    this.logger.log('start backfilling')

    const maxRowsInMemory = CACHE_LIMIT
    const intervalSizeMs: number = KlineIntervalMs[INTERVALS.ONE_MINUTE]
    this.aggregators[this.BASE_SYMBOL] = new OrderFlowAggregator(Exchange.BINANCE, this.BASE_SYMBOL, INTERVALS.ONE_MINUTE, intervalSizeMs, {
      maxCacheInMemory: maxRowsInMemory
    })

    await this.downloadAndProcessCsvFiles()
    await this.saveData()
  }

  private async saveData(): Promise<void> {
    const intervalSavedUUIDs: { [key: string]: string[] } = {}

    for (const interval of Object.keys(this.candles)) {
      const candles = this.candles[interval]
      if (candles.length > 0) {
        // Save the candles for the current interval
        const savedUUIDs = await this.databaseService.batchSaveFootPrintCandles(candles)
        // Store the UUIDs of the saved candles
        intervalSavedUUIDs[interval] = savedUUIDs

        // TODO: Check whether the candles were saved. Handle ones that aren't saved
      }
    }

    // Optional: Log saved UUIDs or perform additional actions with them
    console.log(intervalSavedUUIDs)
  }

  private checkAndBuildNewCandles(baseInterval: INTERVALS = INTERVALS.FIVE_MINUTES, targetInterval: INTERVALS, value: IFootPrintClosedCandle) {
    const rules = CANDLE_BUILDER_RULES[baseInterval]
    const targetRule = rules?.find((rule) => rule.target === targetInterval) ?? rules?.[0]
    const openTime: Date = new Date(value.openTimeMs)
    const { amount, duration } = KlineIntervalTimes[baseInterval]

    if (!targetRule) {
      return
    }

    if (duration === 'minutes') {
      openTime.setMinutes(openTime.getMinutes() + amount, 0, 0)
    } else if (duration === 'h') {
      openTime.setHours(openTime.getHours() + amount, 0, 0)
    }

    if (targetRule?.condition(openTime)) {
      const numCandlesNeeded: number = calculateCandlesNeeded(KlineIntervalMs[baseInterval], KlineIntervalMs[targetRule.target])

      if (this.candles[baseInterval].length >= numCandlesNeeded) {
        const candles: IFootPrintClosedCandle[] = this.candles[baseInterval].slice(-numCandlesNeeded)
        const newCandle: IFootPrintClosedCandle = mergeFootPrintCandles(candles, targetRule.target)

        const nextBase: INTERVALS = targetRule.target
        const nextTarget: INTERVALS = targetRule.target

        this.candles[targetRule.target].push(newCandle)
        this.checkAndBuildNewCandles(nextBase, nextTarget, newCandle)
      }
    }
  }

  private async buildBaseCandle(): Promise<void> {
    const closedCandle: IFootPrintClosedCandle | undefined = this.aggregators[this.BASE_SYMBOL].retireActiveCandle()

    this.aggregators[this.BASE_SYMBOL].clearCandleQueue() // Because we don't need a queue here in this backfiller

    if (closedCandle) {
      this.candles[this.BASE_INTERVAL].push(closedCandle)
    }

    this.aggregators[this.BASE_SYMBOL].createNewCandle(this.exchange, this.BASE_SYMBOL, this.BASE_INTERVAL, KlineIntervalMs[INTERVALS.ONE_MINUTE])
  }

  private processTradeRow(trade: IAggregatedTrade): void {
    const isBuyerMaker: boolean = trade.is_buyer_maker === 'true'
    const quantity: number = Number(trade.quantity)
    const price: number = Number(trade.price)
    this.aggregators[this.BASE_SYMBOL].processNewTrades(isBuyerMaker, quantity, price)
  }

  private async closeAndPrepareNextCandle(): Promise<void> {
    this.currTestTime = new Date(this.nextMinuteCandleClose)
    this.nextMinuteCandleClose = new Date(this.nextMinuteCandleClose.getTime() + 60 * 1000)
    this.aggregators[this.BASE_SYMBOL].setCurrMinute(this.currTestTime)

    await this.buildBaseCandle()
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
    const backfillStartAt = calculateStartDate(process.env.BACKFILL_START_AT as string)
    const backfillEndAt = calculateStartDate(process.env.BACKFILL_END_AT as string)
    let currentTestDate = new Date(backfillStartAt)

    this.currTestTime = new Date(backfillStartAt)
    this.nextMinuteCandleClose = new Date(this.currTestTime.getTime() + 60000)
    this.aggregators[this.BASE_SYMBOL].setCurrMinute(this.currTestTime)

    console.log({ backfillStartAt })
    console.log({ backfillEndAt })
    console.log({ currTestTime: this.currTestTime })
    console.log({ nextMinuteCandleClose: this.nextMinuteCandleClose })

    while (currentTestDate <= backfillEndAt) {
      const dateString = currentTestDate.toISOString().split('T')[0]
      const fileUrl = `${this.baseUrl}/${this.BASE_SYMBOL}/${this.BASE_SYMBOL}-aggTrades-${dateString}.zip`

      try {
        console.time(`downloading ${fileUrl}`)
        const response: any = await firstValueFrom(
          this.httpService.get(fileUrl, {
            responseType: 'arraybuffer'
          })
        )
        console.timeEnd(`downloading ${fileUrl}`)

        console.time(`extracting ${fileUrl}`)
        const zip = await JSZip.loadAsync(response.data)
        const csvFileName: string = Object.keys(zip.files)[0]
        const csvFile: string = await zip.files[csvFileName].async('string')
        console.timeEnd(`extracting ${fileUrl}`)

        console.time(`parsing ${fileUrl}`)
        const trades = parse(csvFile, {
          columns: true,
          skip_empty_lines: true
        })
        console.timeEnd(`parsing ${fileUrl}`)

        console.time(`reading trades`)
        console.log(`trades #${trades.length}`)
        for (let i = 0; i < trades.length; i++) {
          const trade: IAggregatedTrade = trades[i]
          const transactTimestamp: number = Number(trade.transact_time)
          const tradeTime = new Date(transactTimestamp)

          if (tradeTime >= this.nextMinuteCandleClose) {
            await this.closeAndPrepareNextCandle()
          }
          this.processTradeRow(trade)
        }
        console.timeEnd(`reading trades`)
        const cand = this.aggregators[this.BASE_SYMBOL].getAllCandles()
        console.log(cand?.length)

        console.log(`Downloaded and parsed file for ${dateString}`)
        process.exit(1)
      } catch (error) {
        console.error(`Failed to download or process the file for ${dateString}:`, error)
      }

      currentTestDate = new Date(currentTestDate.setDate(currentTestDate.getDate() + 1))
    }
  }
}
