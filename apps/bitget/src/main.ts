import { NestFactory } from '@nestjs/core';
import { BitgetModule } from './bitget.module';

async function bootstrap() {
  const app = await NestFactory.create(BitgetModule);
  await app.listen(3000);
}
bootstrap();
