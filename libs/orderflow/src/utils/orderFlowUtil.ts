import { descendingOrder, mergeDedupeArrays } from './array'
import { getNewestDate, getOldestDate } from './date'
import { doMathOnProp } from './math'
import { IFootPrintClosedCandle, IPriceLevelsClosed } from '../dto/orderflow.dto'
import { FootPrintCandle } from '@database/entity/footprint_candle.entity'

function omitId(candle: FootPrintCandle): Omit<FootPrintCandle, 'id'> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, ...rest } = candle
  return rest
}

function createClosedCandle(candle: Omit<FootPrintCandle, 'id'>, interval: string): IFootPrintClosedCandle {
  return {
    ...candle,
    uuid: crypto.randomUUID(),
    interval,
    openTime: candle.openTime.toISOString(),
    closeTime: candle.closeTime.toISOString(),
    isClosed: true,
    didPersistToStore: false
  }
}

export function mergeFootPrintCandles(candles: FootPrintCandle[], interval: string): IFootPrintClosedCandle {
  if (!candles.length) {
    throw new Error('no candles!')
  }

  const [firstCandle, ...otherCandles] = candles
  const baseCandle = omitId(firstCandle)

  if (otherCandles.length === 0) {
    return createClosedCandle(baseCandle, interval)
  }

  const aggrCandle: Omit<FootPrintCandle, 'id'> = structuredClone(baseCandle)

  for (const candle of otherCandles) aggregateCandleProperties(aggrCandle, candle)

  return {
    ...aggrCandle,
    uuid: crypto.randomUUID(),
    interval,
    openTime: aggrCandle.openTime.toISOString(),
    closeTime: aggrCandle.closeTime.toISOString(),
    isClosed: true,
    didPersistToStore: false
  }
}

function aggregateCandleProperties(aggrCandle: Omit<FootPrintCandle, 'id'>, candle: FootPrintCandle): void {
  const openDts = [new Date(aggrCandle.openTime), new Date(candle.openTime)]
  const closeDts = [new Date(aggrCandle.closeTime), new Date(candle.closeTime)]

  aggrCandle.openTime = getOldestDate(openDts)
  aggrCandle.closeTime = getNewestDate(closeDts)

  aggrCandle.volumeDelta = doMathOnProp(aggrCandle, candle, 'volumeDelta', '+')
  aggrCandle.volume = doMathOnProp(aggrCandle, candle, 'volume', '+')

  aggrCandle.aggressiveBid = doMathOnProp(aggrCandle, candle, 'aggressiveBid', '+')
  aggrCandle.aggressiveAsk = doMathOnProp(aggrCandle, candle, 'aggressiveAsk', '+')

  const imbalancePercent = (aggrCandle.aggressiveBid / (aggrCandle.aggressiveBid + aggrCandle.aggressiveAsk)) * 100
  aggrCandle.bidImbalancePercent = +imbalancePercent.toFixed(2)

  aggrCandle.high = doMathOnProp(aggrCandle, candle, 'high', 'max')
  aggrCandle.low = doMathOnProp(aggrCandle, candle, 'low', 'min')
  aggrCandle.close = candle.close

  aggrCandle.priceLevels = mergePriceLevels(aggrCandle.priceLevels, candle.priceLevels)
}

/**
 * Merge two price levels into one
 */
function mergePriceLevels(levels1: IPriceLevelsClosed, levels2: IPriceLevelsClosed): IPriceLevelsClosed {
  const levelPrices1 = Object.keys(levels1).map((v) => Number(v))
  const levelPrices2 = Object.keys(levels2).map((v) => Number(v))

  const allLevels = mergeDedupeArrays(levelPrices1, levelPrices2).sort(descendingOrder)

  const mergedLevels: IPriceLevelsClosed = {}
  for (const price of allLevels) {
    const level1 = levels1[price]
    const level2 = levels2[price]

    // When both have a value, merge
    if (level1 && level2) {
      const volSumAsk = level1.volSumAsk + level2.volSumAsk
      const volSumBid = level1.volSumBid + level2.volSumBid
      const imbalancePercent = (volSumBid / (volSumBid + volSumAsk)) * 100

      mergedLevels[price] = {
        bidImbalancePercent: +imbalancePercent.toFixed(2),
        volSumAsk: volSumAsk,
        volSumBid: volSumBid
      }
      continue
    }

    // else, only one has a value
    mergedLevels[price] = level1 || level2
  }

  return mergedLevels
}
