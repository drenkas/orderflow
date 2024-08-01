import { Inject, Injectable } from '@nestjs/common'

@Injectable()
export class CacheService {
  constructor(@Inject('REDIS_CONNECTION') private readonly redis) {}

  public async setSymbols(exchange: string, symbols: { [key: string]: string }) {
    await this.redis.HSET(`symbols-${exchange}`, symbols)
  }

  public async getSymbols(exchange: string): Promise<{ [key: string]: string }> {
    return await this.redis.HGETALL(`symbols-${exchange}`)
  }
}
