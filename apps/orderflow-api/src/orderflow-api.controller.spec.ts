import { Test, TestingModule } from '@nestjs/testing';
import { OrderflowApiController } from './orderflow-api.controller';
import { OrderflowApiService } from './orderflow-api.service';

describe('OrderflowApiController', () => {
  let orderflowApiController: OrderflowApiController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [OrderflowApiController],
      providers: [OrderflowApiService],
    }).compile();

    orderflowApiController = app.get<OrderflowApiController>(OrderflowApiController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(orderflowApiController.getHello()).toBe('Hello World!');
    });
  });
});
