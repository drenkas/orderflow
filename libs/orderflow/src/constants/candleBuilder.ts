import { INTERVALS } from '@tsquant/exchangeapi/dist/lib/constants'

export const CANDLE_BUILDER_RULES = Object.freeze({
  [INTERVALS.ONE_MINUTE]: [
    { target: INTERVALS.FIVE_MINUTES, condition: (date: Date) => [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].includes(date.getMinutes()) },
    { target: INTERVALS.FIFTEEN_MINUTES, condition: (date: Date) => [0, 15, 30, 45].includes(date.getMinutes()) },
    { target: INTERVALS.THIRTY_MINUTES, condition: (date: Date) => [0, 30].includes(date.getMinutes()) },
    { target: INTERVALS.ONE_HOUR, condition: (date: Date) => date.getMinutes() === 0 }
  ],
  [INTERVALS.FIVE_MINUTES]: [
    { target: INTERVALS.FIFTEEN_MINUTES, condition: (date: Date) => [0, 15, 30, 45].includes(date.getMinutes()) },
    { target: INTERVALS.THIRTY_MINUTES, condition: (date: Date) => [0, 30].includes(date.getMinutes()) },
    { target: INTERVALS.ONE_HOUR, condition: (date: Date) => date.getMinutes() === 0 },
    { target: INTERVALS.TWO_HOURS, condition: (date: Date) => date.getMinutes() === 0 && [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22].includes(date.getHours()) }
  ],
  [INTERVALS.FIFTEEN_MINUTES]: [
    { target: INTERVALS.THIRTY_MINUTES, condition: (date: Date) => [0, 30].includes(date.getMinutes()) },
    { target: INTERVALS.ONE_HOUR, condition: (date: Date) => date.getMinutes() === 0 },
    {
      target: INTERVALS.TWO_HOURS,
      condition: (date: Date) => date.getMinutes() === 0 && [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22].includes(date.getHours())
    },
    { target: INTERVALS.FOUR_HOURS, condition: (date: Date) => date.getMinutes() === 0 && [0, 4, 8, 12, 16, 20].includes(date.getHours()) }
  ],
  [INTERVALS.THIRTY_MINUTES]: [
    { target: INTERVALS.ONE_HOUR, condition: (date: Date) => date.getMinutes() === 0 },
    {
      target: INTERVALS.TWO_HOURS,
      condition: (date: Date) => date.getMinutes() === 0 && [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22].includes(date.getHours())
    },
    { target: INTERVALS.FOUR_HOURS, condition: (date: Date) => date.getMinutes() === 0 && [0, 4, 8, 12, 16, 20].includes(date.getHours()) }
  ],
  [INTERVALS.ONE_HOUR]: [
    {
      target: INTERVALS.TWO_HOURS,
      condition: (date: Date) => date.getMinutes() === 0 && [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22].includes(date.getHours())
    },
    { target: INTERVALS.FOUR_HOURS, condition: (date: Date) => date.getMinutes() === 0 && [0, 4, 8, 12, 16, 20].includes(date.getHours()) },
    { target: INTERVALS.EIGHT_HOURS, condition: (date: Date) => date.getMinutes() === 0 && [0, 8, 16].includes(date.getHours()) }
  ],
  [INTERVALS.TWO_HOURS]: [
    { target: INTERVALS.FOUR_HOURS, condition: (date: Date) => date.getMinutes() === 0 && [0, 4, 8, 12, 16, 20].includes(date.getHours()) },
    { target: INTERVALS.SIX_HOURS, condition: (date: Date) => date.getMinutes() === 0 && [0, 6, 12, 18].includes(date.getHours()) },
    { target: INTERVALS.EIGHT_HOURS, condition: (date: Date) => date.getMinutes() === 0 && [0, 8, 16].includes(date.getHours()) }
  ],
  [INTERVALS.FOUR_HOURS]: [
    { target: INTERVALS.TWELVE_HOURS, condition: (date: Date) => date.getMinutes() === 0 && [0, 12].includes(date.getHours()) },
    { target: INTERVALS.ONE_DAY, condition: (date: Date) => date.getMinutes() === 0 && date.getHours() === 0 }
  ],
  [INTERVALS.SIX_HOURS]: [
    { target: INTERVALS.TWELVE_HOURS, condition: (date: Date) => date.getMinutes() === 0 && [0, 12].includes(date.getHours()) },
    { target: INTERVALS.ONE_DAY, condition: (date: Date) => date.getMinutes() === 0 && date.getHours() === 0 }
  ],
  [INTERVALS.TWELVE_HOURS]: [{ target: INTERVALS.ONE_DAY, condition: (date: Date) => date.getMinutes() === 0 && date.getHours() === 0 }],
  [INTERVALS.ONE_DAY]: [
    {
      target: INTERVALS.ONE_WEEK,
      condition: (date: Date) => date.getMinutes() === 0 && date.getHours() === 0 && date.getDay() === 0
    }
  ],
  [INTERVALS.ONE_WEEK]: [
    {
      target: INTERVALS.ONE_MONTH,
      condition: (date: Date) => date.getMinutes() === 0 && date.getHours() === 0 && date.getDate() === 1
    }
  ],
  [INTERVALS.ONE_MONTH]: []
})
