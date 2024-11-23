import { Module } from '@nestjs/common';
import { OkxController } from './okx.controller';
import { OkxService } from './okx.service';

@Module({
  imports: [],
  controllers: [OkxController],
  providers: [OkxService],
})
export class OkxModule {}
