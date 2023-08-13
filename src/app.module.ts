import { Module } from '@nestjs/common'
import { ScheduleModule } from '@nestjs/schedule'
import { BinanceService } from 'src/binance/binance.service'
import { BinanceWebSocketService } from 'src/binance/BinanceWebsocketService'
import { ByBitService } from 'src/bybit/bybit.service'
import { BybitWebSocketService } from 'src/bybit/BybitWebsocketService'

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [ByBitService, BybitWebSocketService, BinanceService, BinanceWebSocketService]
})
export class AppModule {}
