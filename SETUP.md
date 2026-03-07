# KeyControl – Setup Guide

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | ≥ 18 | [nodejs.org](https://nodejs.org) |
| npm | ≥ 9 | Bundled with Node.js |
| Docker & Docker Compose | any recent | Required for the local PostgreSQL database |


---

## 1 · Clone & Install

```bash
git clone <repo-url>
cd keycontrol-dev

# Install all dependencies (root + backend + frontend) in one shot
npm run install:all
```

---

## 2 · Configure the Backend Environment

```bash
cp backend/.env.example backend/.env
```

Open `backend/.env` and set the values you need:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string (default works with Docker below) |
| `JWT_SECRET` | ✅ prod | Secret for signing JWTs. Generate with `npm run gen:secret` |
| `ADMIN_TOKEN` | ✅ | Admin login token. Generate with `npm run gen:secret` |
| `CORS_ORIGINS` | ✅ | Comma-separated allowed origins (`http://localhost:5173` for dev) |
| `PORT` | optional | Backend port (default `3001`) |
| `LOG_RETENTION_SECONDS` | optional | How long to keep request logs (default 30 days) |

### Generate secrets quickly

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Or use the convenience script:

```bash
npm run gen:secret
```

---

## 3 · Start the Database

The project uses **PostgreSQL 16** via Docker. The `docker-compose.yml` in the project root configures it.

```bash
# Start the database (runs in the background)
npm run db:up

# Stop it when you're done
npm run db:down
```

The database will be available at `localhost:5433`.  
A second database for tests (`keycontrol_test`) is created automatically by `docker/init-test-db.sql`.

---

## 4 · Run the App

### Development (hot-reload, both services)

```bash
npm run dev
```

| Service | URL |
|---------|-----|
| Backend API | http://localhost:3001 |
| Frontend | http://localhost:5173 |
| API Docs (Scalar) | http://localhost:3001/docs |

### Run services individually

```bash
npm run dev:backend    # backend only (nodemon)
npm run dev:frontend   # frontend only (Vite)
```

---

## 5 · Run Tests

```bash
# Run all backend tests once
npm run test

# Run tests in watch mode (re-runs on file changes)
npm run test:watch
```

---

## 6 · Lint

```bash
npm run lint           # lint frontend TypeScript/TSX
```

---

## 7 · Build for Production

```bash
npm run build          # TypeScript check + Vite production build
npm run preview        # Preview the production build locally
```

---

## 8 · Deploy to Heroku

```bash
# From the project root, pass your Heroku app name:
npm run deploy -- your-heroku-app-name
```

---


