const months = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
]

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
