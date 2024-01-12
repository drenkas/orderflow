import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ApiController } from './api.controller'
import { DatabaseModule } from '@database'
import { ORMConfig } from '@database/ormconfig'

@Module({
  imports: [TypeOrmModule.forRoot(ORMConfig), DatabaseModule],
  controllers: [ApiController]
})
export class OrderflowApiModule {}
