import { Logger } from '@nestjs/common'

export function validateEnvironment() {
  const backfillStartAt: string | undefined = process.env.BACKFILL_START_AT
  const pairsString: string | undefined = process.env.SYMBOLS
  let pairs: string[] = []

  if (!backfillStartAt || !isValidDuration(backfillStartAt)) {
    Logger.error(
      // eslint-disable-next-line max-len
      `BACKFILL_START_AT is not defined or has an invalid format in 'backtest' mode. Expected format: '1Y2M' (1 year and 2 months). Example: '2Y' for 2 years, '6M' for 6 months, '1Y6M' for 1 year and 6 months.`,
      'EnvironmentValidation'
    )
    return false
  }

  // Check if SYMBOLS is a non-empty string
  if (typeof pairsString !== 'string' || pairsString.trim() === '') {
    Logger.error(`SYMBOLS must be a non-empty comma-separated string. Current value: ${pairsString}`, 'EnvironmentValidation')
    return false
  }

  // Convert SYMBOLS string to an array and validate it
  pairs = pairsString.split(',')
  if (pairs.length === 0) {
    Logger.error(`SYMBOLS string could not be converted to a valid array. Current value: ${pairsString}`, 'EnvironmentValidation')
    return false
  }

  // Check if each pair ends with 'USDT'
  for (const pair of pairs) {
    if (!pair.endsWith('USDT')) {
      Logger.error(`Each pair in SYMBOLS must end with 'USDT'. Invalid pair: ${pair}`, 'EnvironmentValidation')
      return false
    }
  }

  return true
}

export function isValidDuration(durationStr: string): boolean {
  // Regular expression to match the duration format
  // ^ asserts position at start of the string
  // (\d+Y)? matches zero or one occurrence of one or more digits followed by 'Y'
  // (\d+M)? matches zero or one occurrence of one or more digits followed by 'M'
  // $ asserts position at the end of the string
  const durationRegex = /^(\d+Y)?(\d+M)?$/

  // Test if the durationStr matches the pattern
  return durationRegex.test(durationStr)
}
