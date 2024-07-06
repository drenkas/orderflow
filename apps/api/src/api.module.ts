import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ApiController } from './api.controller'
import { DatabaseModule } from '@database'
import { DatabaseConfiguration } from '@database/ormconfig'

@Module({
  imports: [TypeOrmModule.forRoot(DatabaseConfiguration), DatabaseModule],
  controllers: [ApiController]
})
export class OrderflowApiModule {}
