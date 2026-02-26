FROM node:20-alpine

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy source code
COPY src/ ./src/

# Heroku assigns PORT dynamically — app must listen on $PORT
ENV NODE_ENV=production

# Expose for local testing only (Heroku ignores this)
EXPOSE 3001

CMD ["node", "src/server.js"]
