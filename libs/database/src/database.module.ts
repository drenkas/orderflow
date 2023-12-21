import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { DatabaseService } from '@database/database.service'
import { FootPrintCandle } from '@database/entity/footprint_candle.entity'
import { FootPrintCandleLevel } from './entity/footprint_candle_level.entity'

@Module({
  imports: [TypeOrmModule.forFeature([FootPrintCandle, FootPrintCandleLevel])],
  providers: [DatabaseService],
  exports: [DatabaseService]
})
export class DatabaseModule {}
