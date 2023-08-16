import { NestFactory } from '@nestjs/core';
import { OrderflowApiModule } from './orderflow-api.module';

async function bootstrap() {
  const app = await NestFactory.create(OrderflowApiModule);
  await app.listen(3000);
}
bootstrap();
