import { Module } from '@nestjs/common'
import { BinanceService } from 'src/binance/binance.service'
import { BinanceWebSocketService } from 'src/binance/BinanceWebsocketService'
import { ByBitService } from 'src/bybit/bybit.service'
import { BybitWebSocketService } from 'src/bybit/BybitWebsocketService'

@Module({
  imports: [],
  controllers: [],
  providers: [ByBitService, BybitWebSocketService, BinanceService, BinanceWebSocketService]
})
export class AppModule {}
