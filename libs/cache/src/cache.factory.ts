import { LoggerService } from '@nestjs/common'
import { createClient, RedisClientType } from 'redis'

export const connectToCache = async (logger: LoggerService) => {
  const url = process.env.REDIS_URI
  try {
    const redis: RedisClientType = createClient({ url })
    await redis.connect()
    logger.log(`Redis connection established @ ${url}.`)

    return redis
  } catch (e) {
    logger.error(`Could not connect to Redis @ ${url}! Reason: ${e.message}`)
  }

  throw new Error('Could not connect to cache!')
}
