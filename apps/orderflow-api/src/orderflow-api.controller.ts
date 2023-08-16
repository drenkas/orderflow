import { Controller, Get } from '@nestjs/common';
import { OrderflowApiService } from './orderflow-api.service';

@Controller()
export class OrderflowApiController {
  constructor(private readonly orderflowApiService: OrderflowApiService) {}

  @Get()
  getHello(): string {
    return this.orderflowApiService.getHello();
  }
}
