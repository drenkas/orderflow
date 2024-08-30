# Orderflow

This project offers a solution for collecting, processing, and analysing high-frequency orderflow data from major cryptocurrency exchanges. Built with Node.js/TypeScript and leveraging the NestJS framework, it comprises three specialised applications:

1. Real-time data collection from **Binance futures market**.
2. Real-time data collection from **Bybit**.
3. Historical data processing for **Binance**.

The system processes live trade data in real-time, aggregating it into 1-minute Footprint candles and subsequently constructing higher timeframe Footprint candles. This approach offers a granular view of order flow, volume, and price action, providing deep insights into market dynamics. The resulting data is important for developing advanced trading strategies, performing detailed market analysis, and powering sophisticated algorithmic trading systems.

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

3. Set up a PostgreSQL TimescaleDB instance (if not already running):
   ```
   docker run -d --name timescaledb -p 5433:5432 -e POSTGRES_PASSWORD=password timescale/timescaledb-ha:pg14-latest
   ```

4. Set environment variables:
   - `DB_HOST`
   - `DB_PORT`
   - `DB_USERNAME`
   - `DB_PASSWORD`
   - `DB_NAME`
   - `SYMBOLS` (Comma-separated list of trading pairs. Defaults to all exchange symbols if not explicitly set)

## Usage

### Binance and Bybit Live Data Processing

1. Build the Docker images:
   ```
   docker-compose build binance
   docker-compose build bybit
   ```

2. Run the services:
   ```
   docker-compose up -d binance
   docker-compose up -d bybit
   ```

These services will continuously run, processing live trade data from their respective exchanges.

### Binance Backfill

For historical data processing:

1. Obtain CSV files from Binance's market data: https://data.binance.vision/?prefix=data/futures/um/daily/
2. Run the Binance Backfill service, specifying start and end dates.

## How It Works

### Binance and Bybit Services

1. Connect to exchange websockets for live trade data.
2. Aggregate raw trades into 1-minute candles.
3. Build higher timeframe candles from 1-minute candles.
4. Store processed data in TimescaleDB.

Key components:
- `BinanceService`/`BybitService`: Main service handling websocket connections and data processing.
- `OrderFlowAggregator`: Aggregates trades into candles.
- `CandleQueue`: Manages the queue of candles to be persisted to the database.

### Binance Backfill

For historical data processing:

Obtain CSV files from Binance's market data: https://data.binance.vision/?prefix=data/futures/um/daily/
Set the following environment variables:

- `BACKFILL_START_AT`: Start timestamp for backfill data processing
- `BACKFILL_END_AT`: End timestamp for backfill data processing


Run the Binance Backfill service:
   ```
   yarn start:binance-backfill
   ```

The Binance Backfill service will process historical data for the specified date range and terminate upon completion.

## Dependencies

- NestJS
- `binance` and `bybit-api` libraries by [@tiagosiebler](https://github.com/tiagosiebler).
- PostgreSQL with TimescaleDB extension.

## Notes

- Ensure the TimescaleDB instance is running before starting the services.
- The Binance Backfill service is not designed for continuous operation and will terminate upon completion.
- For advanced analysis of the generated orderflow data, consider using the [chart-patterns library](https://github.com/focus1691/chart-patterns), which provides indicators for:
   - **Stacked Imbalances:** Identify stacks of buying/selling imbalances on the price level.
   - **High Volume Nodes:** Pinpoint areas where significant trade volume occurred.
