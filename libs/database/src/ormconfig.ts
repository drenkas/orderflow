require('dotenv').config()

import { FootPrintCandle } from '@database/entity/footprint_candle.entity'
import { TypeOrmModuleOptions } from '@nestjs/typeorm'

export const ORMConfig: TypeOrmModuleOptions = {
  type: 'postgres',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: [FootPrintCandle],
  synchronize: true
}
