require('dotenv').config();

import { DataSource, DataSourceOptions } from 'typeorm';
import { FootPrintCandle } from '@database/entity/footprint_candle.entity';

export const DatabaseConfiguration: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: [FootPrintCandle],
  synchronize: false
};

export const AppDataSource = new DataSource(DatabaseConfiguration);
