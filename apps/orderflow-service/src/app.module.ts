import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ScheduleModule } from '@nestjs/schedule'
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm'
import { DatabaseModule } from '@database'
import ormconfig from '@database/ormconfig'
import { BinanceService } from 'apps/orderflow-service/src/binance/binance.service'
import { BinanceWebSocketService } from 'apps/orderflow-service/src/binance/BinanceWebsocketService'
import { ByBitService } from 'apps/orderflow-service/src/bybit/bybit.service'
import { BybitWebSocketService } from 'apps/orderflow-service/src/bybit/BybitWebsocketService'

@Module({
  imports: [ConfigModule.forRoot({}), ScheduleModule.forRoot(), TypeOrmModule.forRoot(ormconfig as TypeOrmModuleOptions), DatabaseModule],
  providers: [ByBitService, BybitWebSocketService, BinanceService, BinanceWebSocketService]
})
export class AppModule {}
