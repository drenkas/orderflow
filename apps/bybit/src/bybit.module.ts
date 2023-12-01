import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ScheduleModule } from '@nestjs/schedule'
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm'
import { AppService } from './app.service'
import { DatabaseModule } from '@database'
import ormconfig from '@database/ormconfig'
import { ByBitService } from 'apps/bybit/src/bybit.service'
import { BybitWebSocketService } from 'apps/bybit/src/BybitWebsocketService'

@Module({
  imports: [ConfigModule.forRoot({}), ScheduleModule.forRoot(), TypeOrmModule.forRoot(ormconfig as TypeOrmModuleOptions), DatabaseModule],
  providers: [AppService, ByBitService, BybitWebSocketService]
})
export class BinanceModule {}
