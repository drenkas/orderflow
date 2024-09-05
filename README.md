# Orderflow

This project offers a solution for generating orderflow data from Binance and Bybit. Built with Node.js/TypeScript and leveraging the NestJS framework, it comprises three applications:

1. Real-time data collection from **Binance Perps**.
2. Real-time data collection from **Bybit Perps**.
3. Historical data processing for **Binance**.

The system processes live trade data in real-time, aggregating it into 1-minute Footprint candles and then building higher timeframe Footprint candles. This data is crucial for revealing the underlying trade information associated with each candle.

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
   - `DB_HOST`
   - `DB_PORT`
   - `DB_USERNAME`
   - `DB_PASSWORD`
   - `DB_NAME`
   - `SYMBOLS` (CSV. Defaults to all exchange symbols)

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

## How It Works

Binance and Bybit services run continuously, aggregating live trade data to construct Footprint candles through the following steps:

1. Connect to exchange WebSockets to receive live trade data.
2. Aggregate raw trades into 1-minute candles.
3. Construct higher timeframe candles from the 1-minute candles.
4. Store the processed data in TimescaleDB.

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

The service automatically downloads and processes the required CSV files from [Binance Market Data](https://data.binance.vision/?prefix=data/futures/um/daily/) for the specified symbols and date range, creating footprint candles from the historical data.

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
