import { HttpModule } from '@nestjs/axios'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { BackfillService } from './backfill.service'
import { DatabaseModule } from '@database'
import { ORMConfig } from '@database/ormconfig'

@Module({
  imports: [ConfigModule.forRoot({}), HttpModule, TypeOrmModule.forRoot(ORMConfig), DatabaseModule],
  providers: [BackfillService]
})
export class BinanceBackfillModule {}
