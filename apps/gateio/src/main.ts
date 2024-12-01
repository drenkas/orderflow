import { NestFactory } from '@nestjs/core';
import { GateioModule } from './gateio.module';

async function bootstrap() {
  const app = await NestFactory.create(GateioModule);
  await app.listen(3000);
}
bootstrap();
