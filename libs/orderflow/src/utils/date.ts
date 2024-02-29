import { INTERVALS } from '@tsquant/exchangeapi/dist/lib/constants/candles'

const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export const createFormattedDate = (date: Date): string => {
  const dayOfMonth = date.getDate()
  const month = months[date.getMonth()]
  const year = date.getFullYear()
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  const seconds = date.getSeconds().toString().padStart(2, '0')

  return `${dayOfMonth} ${month} ${year} ${hours}:${minutes}:${seconds}`
}

export const getStartOfMinute = (): Date => {
  const now = new Date()
  now.setSeconds(0, 0)
  return now
}

/**
 * Get the oldest date in an array of dates
 */
export function getOldestDate(arrayOfDates: Date[]): Date {
  return arrayOfDates.reduce((c, n) => (n < c ? n : c))
}

/**
 * Get the most recent data in an array of dates
 */
export function getNewestDate(arrayOfDates: Date[]): Date {
  return arrayOfDates.reduce((c, n) => (n > c ? n : c))
}

export function calculateStartDate(startAt: string) {
  const regex = /(\d+Y)?(\d+M)?/
  const [, years, months] = startAt.match(regex) || []

  const date = new Date()
  if (years) {
    date.setFullYear(date.getFullYear() - parseInt(years, 10))
  }
  if (months) {
    date.setMonth(date.getMonth() - parseInt(months, 10))
  }
  date.setDate(1) // Set to the first day of the calculated month

  return date
}

export const alignsWithTargetInterval = (targetInterval: INTERVALS, date: Date) => {
  const hours = date.getHours()
  const minutes = date.getMinutes()
  const dayOfWeek = date.getDay() // Sunday - 0, Monday - 1, ..., Saturday - 6
  const dayOfMonth = date.getDate()

  switch (targetInterval) {
    case INTERVALS.FIVE_MINUTES:
      return [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].includes(minutes)
    case INTERVALS.FIFTEEN_MINUTES:
      return [0, 15, 30, 45].includes(minutes)
    case INTERVALS.THIRTY_MINUTES:
      return [0, 30].includes(minutes)
    case INTERVALS.ONE_HOUR:
      return minutes === 0
    case INTERVALS.TWO_HOURS:
      return minutes === 0 && [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22].includes(hours)
    case INTERVALS.FOUR_HOURS:
      return minutes === 0 && [0, 4, 8, 12, 16, 20].includes(hours)
    case INTERVALS.EIGHT_HOURS:
      return minutes === 0 && [0, 8, 16].includes(hours)
    case INTERVALS.TWELVE_HOURS:
      return minutes === 0 && (hours === 0 || hours === 12)
    case INTERVALS.ONE_DAY:
      return hours === 0 && minutes === 0
    case INTERVALS.ONE_WEEK:
      // Assuming the start of the week is Sunday
      return dayOfWeek === 0 && hours === 0 && minutes === 0
    case INTERVALS.ONE_MONTH:
      // Assuming the start of the month is the first day
      return dayOfMonth === 1 && hours === 0 && minutes === 0
    default:
      return false
  }
}
