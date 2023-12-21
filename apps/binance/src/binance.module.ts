import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ScheduleModule } from '@nestjs/schedule'
import { TypeOrmModule } from '@nestjs/typeorm'
import { DatabaseModule } from '@database'
import { ORMConfig } from '@database/ormconfig'
import { BinanceService } from 'apps/binance/src/binance.service'
import { BinanceWebSocketService } from 'apps/binance/src/BinanceWebsocketService'

@Module({
  imports: [ConfigModule.forRoot({}), ScheduleModule.forRoot(), TypeOrmModule.forRoot(ORMConfig), DatabaseModule],
  providers: [BinanceService, BinanceWebSocketService]
})
export class BinanceModule {}
