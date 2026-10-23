# Railway Dockerfile for Rawasi Aden System
# Requires Node 22+ for native node:sqlite support
FROM node:22-bookworm-slim

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev

# Copy all source files
COPY . .

# Environment configuration
ENV NODE_ENV=production
ENV HOST=0.0.0.0

EXPOSE 5500 8080

# Start server
CMD ["node", "server/server.js"]
