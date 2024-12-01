import { Module } from '@nestjs/common';
import { GateioController } from './gateio.controller';
import { GateioService } from './gateio.service';

@Module({
  imports: [],
  controllers: [GateioController],
  providers: [GateioService],
})
export class GateioModule {}
