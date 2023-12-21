import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ScheduleModule } from '@nestjs/schedule'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AppService } from './app.service'
import { DatabaseModule } from '@database'
import { ORMConfig } from '@database/ormconfig'
import { ByBitService } from 'apps/bybit/src/bybit.service'
import { BybitWebSocketService } from 'apps/bybit/src/BybitWebsocketService'

@Module({
  imports: [ConfigModule.forRoot({}), ScheduleModule.forRoot(), TypeOrmModule.forRoot(ORMConfig), DatabaseModule],
  providers: [AppService, ByBitService, BybitWebSocketService]
})
export class BinanceModule {}
