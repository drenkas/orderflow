FROM node:16

WORKDIR /app

# Copy .npmrc file for private package access
COPY .npmrc ./

# Copy package.json and yarn.lock files
COPY apps/binance/package.json ./package.json
COPY apps/binance/yarn.lock ./yarn.lock

# Install dependencies
RUN yarn install

# Copy tsconfig files
COPY tsconfig.json ./
COPY tsconfig.build.json ./

# Copy required libraries
COPY libs/ ./libs/

# Copy everything from the apps/binance directory to the Docker image
COPY apps/binance/ .

# Build the application
RUN yarn build:binance

EXPOSE 3000

CMD [ "node", "dist/main.js" ]
