# Orderflow

Real-time services to deploy in a docker container to aggregate live trades and build footprint candles. Supports Binance and Bybit (crypto).

Services:

1. Binance Live.
2. Bybit Live.
3. Binance Backfiller.

## Get Started

1. Clone the repository:
   ```
   git clone git@github.com:focus1691/orderflow.git
   ```

2. Set up a PostgreSQL TimescaleDB instance (Required):
   ```
   docker run -d --name timescaledb -p 5433:5432 -e POSTGRES_PASSWORD=password timescale/timescaledb-ha:pg14-latest
   ```

3. Configure environment variables:
   - `DB_URL`
   - `SYMBOLS` (CSV. Defaults to all exchange symbols)
  
4. Build and Run the services:
   ```
   docker-compose up --build -d binance
   ```
   ```
   docker-compose up --build -d bybit
   ```
   

## Binance Backfill

For historical data processing:

1. Set the following environment variables:
   - `SYMBOLS`: Trading pair(s) to backfill for. Comma-separated values.
   - `BACKFILL_START_AT`: Start timestamp (ms)
   - `BACKFILL_END_AT`: End timestamp (ms)

2. Run the Binance Backfill service:
   ```
   yarn start:binance-backfill
   ```
