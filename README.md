# Orderflow

This project offers a solution for aggregating live trades and building footprint candles for Binance and Bybit.

Three services:

1. Real-time trade data aggregated into footprint candles for Binance.
2. Real-time trade data aggregated into footprint candles for Bybit.
3. Backfilling (historical) footprint candle generation for Binance.

## Installation

1. Clone the repository:
   ```
   git clone https://github.com/focus1691/orderflow
   cd orderflow
   ```

2. Install dependencies:
   ```
   yarn install
   ```

3. Set up a PostgreSQL TimescaleDB instance (Required):
   ```
   docker run -d --name timescaledb -p 5433:5432 -e POSTGRES_PASSWORD=password timescale/timescaledb-ha:pg14-latest
   ```

4. Configure environment variables:
   - `DB_URL`
   - `SYMBOLS` (CSV. Defaults to all exchange symbols)
  
5. Build and Run the services:
   ```
   docker-compose build binance
   docker-compose build bybit
   docker-compose up -d binance
   docker-compose up -d bybit
   ```

## Binance Backfill

For historical data processing:

1. Set the following environment variables:
   - `SYMBOLS`: Specify the trading pair(s) for which you want to process historical data (comma-separated if multiple)
   - `BACKFILL_START_AT`: Start timestamp for backfill data processing
   - `BACKFILL_END_AT`: End timestamp for backfill data processing

2. Run the Binance Backfill service:
   ```
   yarn start:binance-backfill
   ```
