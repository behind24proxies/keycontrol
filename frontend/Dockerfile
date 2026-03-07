# ── Stage 1: Build ─────────────────────────────────────────────────────────
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# In the unified Docker setup, frontend and backend share the same origin
# via Nginx reverse proxy, so the API URL is just the relative path /api.
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# ── Stage 2: Serve with Nginx ──────────────────────────────────────────────
FROM nginx:alpine

# Remove default nginx config
# (custom config is mounted via docker-compose volume from docker/nginx.conf)
RUN rm /etc/nginx/conf.d/default.conf

# Copy built frontend assets
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
