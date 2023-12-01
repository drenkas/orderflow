import { Module } from '@nestjs/common'
import { OrderflowService } from './orderflow.service'

@Module({
  providers: [OrderflowService],
  exports: [OrderflowService]
})
export class OrderflowModule {}
