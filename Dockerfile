FROM node:24.13.1-alpine

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install pnpm
RUN npm install -g pnpm

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the TypeScript code
RUN pnpm run build

# Create data directory for SQLite
RUN mkdir -p /app/data

# Expose the port
EXPOSE 3000

RUN pnpx prisma migrate deploy
RUN pnpx prisma generate

# Start the application
CMD ["node", "dist/index.js"]
