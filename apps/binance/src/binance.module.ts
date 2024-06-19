import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ScheduleModule } from '@nestjs/schedule'
import { TypeOrmModule } from '@nestjs/typeorm'
import { DatabaseModule } from '@database'
import { DatabaseConfiguration } from '@database/ormconfig'
import { BinanceService } from 'apps/binance/src/binance.service'
import { BinanceWebSocketService } from 'apps/binance/src/BinanceWebsocketService'

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), ScheduleModule.forRoot(), TypeOrmModule.forRoot(DatabaseConfiguration), DatabaseModule],
  providers: [BinanceService, BinanceWebSocketService]
})
export class BinanceModule {}
