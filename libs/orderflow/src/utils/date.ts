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

const INTERVAL_MS_MAP = {
  '1m': 1000 * 60
}

export function getMsForInterval(interval: string): number {
  const ms = INTERVAL_MS_MAP[interval]
  if (!ms) {
    throw new Error(`Unknown ms per interval "${interval}"`)
  }
  return ms
}
