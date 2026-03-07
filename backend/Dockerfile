FROM node:20-alpine

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy source code
COPY src/ ./src/

# Copy OpenAPI spec (served by Scalar docs at /docs)
COPY openapi.yaml ./

# Production mode
ENV NODE_ENV=production

EXPOSE 3001

# Healthcheck for Docker Compose dependency ordering
HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=5 \
  CMD wget -qO- http://localhost:3001/api || exit 1

CMD ["node", "src/server.js"]
