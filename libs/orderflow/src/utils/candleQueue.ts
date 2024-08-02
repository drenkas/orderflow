import { DatabaseService } from '@database/database.service'
import { IFootPrintClosedCandle } from '@orderflow/dto/orderflow.dto'

export class CandleQueue {
  /** Queue of candles that may not yet have reached the DB yet (closed candles) */
  private queue: IFootPrintClosedCandle[] = []

  private databaseService: DatabaseService

  private isProcessingJob: boolean = false

  constructor(databaseService: DatabaseService) {
    this.databaseService = databaseService
  }

  /** Get only candles that haven't been saved to DB yet */
  public getQueuedCandles(): IFootPrintClosedCandle[] {
    return this.queue.filter((candle) => !candle.didPersistToStore)
  }

  public enqueCandle(candle: IFootPrintClosedCandle): void {
    this.queue.push(candle)
  }

  private clearQueue(): void {
    this.queue = []
  }

  /** Marks which candles have been saved to DB */
  public markSavedCandles(savedUUIDs: string[]) {
    for (const uuid of savedUUIDs) {
      const candle = this.queue.find((c) => c.uuid === uuid)
      if (candle) {
        candle.didPersistToStore = true
      } else {
        console.log(`no candle found for uuid (${uuid})`, this.queue)
      }
    }
  }

  public async persistCandlesToStorage({ clearQueue }: { clearQueue: boolean }): Promise<void> {
    const queuedCandles = this.getQueuedCandles()
    if (queuedCandles.length === 0) {
      return
    }

    console.log(
      'Saving batch of candles',
      queuedCandles.map((c) => `${c.symbol} ${c.interval} ${c.openTime}`)
    )

    const savedUUIDs = await this.databaseService.batchSaveFootPrintCandles([...queuedCandles])

    // Filter out successfully saved candles
    this.markSavedCandles(savedUUIDs)

    if (clearQueue) {
      this.clearQueue()
    }
  }
}
