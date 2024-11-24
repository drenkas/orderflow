# Orderflow

An Orderflow trade aggregator to deploy in the cloud that builds Footprint Candles by aggregating raw trades from Websockets. Supports Binance, Bybit, Okx, and Bitget for now.

## Get Started

1. Clone the repository:
   ```
   git clone git@github.com:focus1691/orderflow.git
   ```

2. Set up a PostgreSQL TimescaleDB instance (Required):
   ```
   docker run -d --name timescaledb -p 5433:5432 -e POSTGRES_PASSWORD=password timescale/timescaledb-ha:pg14-latest
   ```

3. Set up a RabbitMQ instance (optional) to listen for candle closes:
   ```
   docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 -e RABBITMQ_DEFAULT_USER=admin -e RABBITMQ_DEFAULT_PASS=admin rabbitmq:4.0-management
   ```

4. Configure environment variables:
   - `DB_URL`
   - `USE_RABBITMQ`
   - `RABBITMQ_URL`
   - `BINANCE_DOCKER_PORT`
   - `BYBIT_DOCKER_PORT`
   - `OKX_DOCKER_PORT`
   - `BITGET_DOCKER_PORT`
   - `SYMBOLS`

5. Build and Run the services:
   ```
   yarn binance:docker
   ```
   ```
   yarn bybit:docker
   ```
   ```
   yarn okx:docker
   ```
   ```
   yarn bitget:docker
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
