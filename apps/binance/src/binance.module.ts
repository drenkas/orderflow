import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ScheduleModule } from '@nestjs/schedule'
import { TypeOrmModule } from '@nestjs/typeorm'
import { DatabaseModule } from '@database'
import { DatabaseConfiguration } from '@database/ormconfig'
import { BinanceService } from './binance.service'
import { BinanceWebSocketService } from './BinanceWebsocketService'
import { CacheModule } from '@cache/cache.module'

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), ScheduleModule.forRoot(), TypeOrmModule.forRoot(DatabaseConfiguration), DatabaseModule, CacheModule],
  providers: [BinanceService, BinanceWebSocketService]
})
export class BinanceModule {}
