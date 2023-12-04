FROM node:16

WORKDIR /app

# Copy package.json and yarn.lock files
COPY apps/api/package.json ./package.json
COPY apps/api/yarn.lock ./yarn.lock

# Install dependencies
RUN yarn install

# Copy tsconfig files
COPY tsconfig.json ./
COPY tsconfig.build.json ./

# Copy required libraries
COPY libs/ ./libs/

# Copy everything from the apps/api directory to the Docker image
COPY apps/api/ .

# Build the application
RUN yarn build:api

EXPOSE 3000

CMD [ "node", "dist/main.js" ]
