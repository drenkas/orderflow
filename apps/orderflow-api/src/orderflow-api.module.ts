import { Module } from '@nestjs/common'
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm'
import { ApiController } from '@orderflow-api/orderflow-api.controller'
import { DatabaseModule } from '@database'
import ormconfig from '@database/ormconfig'

@Module({
  imports: [TypeOrmModule.forRoot(ormconfig as TypeOrmModuleOptions), DatabaseModule],
  controllers: [ApiController]
})
export class OrderflowApiModule {}
