import { Logger, Module } from '@nestjs/common'
import { CacheService } from '@cache'
import { connectToCache } from '@cache/cache.factory'

@Module({
  providers: [
    {
      provide: 'REDIS_CONNECTION',
      useFactory: async () => {
        const redis = await connectToCache(new Logger('CacheModule'))
        return redis
      }
    },
    CacheService
  ],
  exports: [CacheService]
})
export class CacheModule {}
