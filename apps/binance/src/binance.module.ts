import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatabaseModule, DatabaseConfiguration } from '@database';
import { RabbitMQModule } from '@rabbitmq';
import { BinanceService } from './binance.service';
import { BinanceWebSocketService } from './binance.websocket.service';
import { TelegramService } from '@shared/telegram.service';
import { TelegramChat } from '@database/entity/telegram_chat.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRoot(DatabaseConfiguration),
    DatabaseModule,
    RabbitMQModule,
    TypeOrmModule.forFeature([TelegramChat])
  ],
  providers: [BinanceService, BinanceWebSocketService, TelegramService]
})
export class BinanceModule {}
