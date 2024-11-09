# Orderflow

Real-time 24/7 aggregate live trades to build footprint candles. Supports Binance and Bybit (crypto).

Services:

1. Binance Live.
2. Bybit Live.
3. Binance Backfiller.

## Get Started

1. Clone the repository:
   ```
   git clone https://github.com/focus1691/orderflow
   cd orderflow
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
   - `SYMBOLS`: Specify the trading pair(s) for which you want to process historical data (comma-separated if multiple)
   - `BACKFILL_START_AT`: Start timestamp for backfill data processing
   - `BACKFILL_END_AT`: End timestamp for backfill data processing

2. Run the Binance Backfill service:
   ```
   yarn start:binance-backfill
   ```
