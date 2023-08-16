import { Module } from '@nestjs/common';
import { OrderflowApiController } from './orderflow-api.controller';
import { OrderflowApiService } from './orderflow-api.service';

@Module({
  imports: [],
  controllers: [OrderflowApiController],
  providers: [OrderflowApiService],
})
export class OrderflowApiModule {}
