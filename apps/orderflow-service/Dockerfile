FROM node:16

WORKDIR /app

# Copy package.json and yarn.lock files
COPY apps/orderflow-service/package.json ./package.json
COPY apps/orderflow-service/yarn.lock ./yarn.lock

# Install dependencies
RUN yarn install

# Copy tsconfig files
COPY tsconfig.json ./
COPY tsconfig.build.json ./

# Copy required libraries
COPY libs/ ./libs/

# Copy everything from the apps/orderflow-service directory to the Docker image
COPY apps/orderflow-service/ .

# Build the application
RUN yarn build:orderflow-service

EXPOSE 3000

CMD [ "node", "dist/main.js" ]