import { Module } from '@nestjs/common'
import { BackfillService } from './backfill.service'

@Module({
  imports: [],
  providers: [BackfillService]
})
export class BinanceBackfillModule {}
