import { Module } from '@nestjs/common'
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm'
import { ApiController } from '@orderflow-api/orderflow-api.controller'
import { ApiService } from '@orderflow-api/orderflow-api.service'
import { DatabaseModule } from '@database'
import ormconfig from '@database/ormconfig'

@Module({
  imports: [TypeOrmModule.forRoot(ormconfig as TypeOrmModuleOptions), DatabaseModule],
  controllers: [ApiController],
  providers: [ApiService]
})
export class OrderflowApiModule {}
