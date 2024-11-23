import { Module } from '@nestjs/common';
import { BitgetService } from './bitget.service';

@Module({
  imports: [],
  providers: [BitgetService]
})
export class BitgetModule {}
