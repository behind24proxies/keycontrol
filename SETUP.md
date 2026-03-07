# KeyControl – Setup Guide

This guide covers **local development** and **production deployment** (VPS with Docker).

---

## Part 1: Local Development

### Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | ≥ 18 | [nodejs.org](https://nodejs.org) |
| npm | ≥ 9 | Bundled with Node.js |
| Docker & Docker Compose | any recent | [docker.com/get-docker](https://docs.docker.com/get-docker/) |

### 1 · Clone & Install

```bash
git clone <repo-url>
cd keycontrol-dev

# Install all dependencies (root + backend + frontend) in one shot
npm run install:all
```

### 2 · Configure the Backend

```bash
cp backend/.env.example backend/.env
```

Open `backend/.env` and set the values:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | ✅ | `postgresql://postgres:postgres@localhost:5433/keycontrol` | PostgreSQL connection string (default works with Docker below) |
| `JWT_SECRET` | ✅ prod | `dev-secret` | Secret for signing JWTs |
| `ADMIN_TOKEN` | ✅ | *(empty)* | Initial admin password (used on first boot only) |
| `CORS_ORIGINS` | ✅ | `http://localhost:5173` | Comma-separated allowed origins |
| `PORT` | — | `3001` | Backend port |
| `LOG_RETENTION_SECONDS` | — | `2592000` | How long to keep request logs (30 days) |

> **Generate secrets** with: `npm run gen:secret`

### 3 · Start the Database

The project uses **PostgreSQL 16** via Docker:

```bash
npm run db:up          # Start postgres (background)
npm run db:down        # Stop postgres
npm run db:reset       # Destroy data and recreate
npm run db:logs        # Tail postgres logs
```

The database runs at `localhost:5433`. A test database (`keycontrol_test`) is created automatically.

### 4 · Run the App

```bash
npm run dev            # Start backend + frontend with hot-reload
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:3001 |
| API Docs (Scalar) | http://localhost:3001/docs |

```bash
npm run dev:backend    # Backend only (nodemon)
npm run dev:frontend   # Frontend only (Vite)
```

### 5 · Run Tests

```bash
npm run test           # Run all backend tests once
npm run test:watch     # Watch mode (re-runs on file changes)
```

### 6 · Lint & Build

```bash
npm run lint           # Lint frontend TypeScript/TSX
npm run build          # TypeScript check + Vite production build
npm run preview        # Preview the production build locally
```

---

## Part 2: Production Deployment (VPS)

The production Docker Compose setup runs the **entire stack** — PostgreSQL, Backend, and Frontend — behind an Nginx reverse proxy.

### Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  Your VPS                                                    │
│                                                              │
│   Port 80   → Nginx                                          │
│               ├── /api/*        → Backend (admin REST API)   │
│               ├── /docs         → Backend (API docs)         │
│               └── /*            → Frontend SPA               │
│                                                              │
│   Port 3001 → Backend (direct)                               │
│               └── /:resource/*  → Gateway proxy for API keys │
│                                                              │
│   (internal) → PostgreSQL :5432                              │
└──────────────────────────────────────────────────────────────┘
```

### Prerequisites

On your VPS, you need:
- **Docker Engine** ≥ 20
- **Docker Compose** V2 (usually bundled with Docker Engine)
- **Git** (to clone the repo)

> **Installing Docker on a fresh VPS (Ubuntu/Debian):**
> ```bash
> curl -fsSL https://get.docker.com | sh
> sudo usermod -aG docker $USER
> # Log out and back in for group change to take effect
> ```

### Step-by-Step Deployment

#### 1. Clone the project

```bash
git clone <repo-url>
cd keycontrol-dev
```

#### 2. Create your production environment file

```bash
cp .env.production.example .env.production
```

#### 3. Generate and fill in secrets

Open `.env.production` in a text editor and set **every** `CHANGE_ME` value:

```bash
# Generate a strong password/secret (run this multiple times for each value):
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

> If you don't have Node.js on the VPS, you can also use:
> ```bash
> openssl rand -hex 32
> ```

Here's what each variable does:

| Variable | What to set | Example |
|----------|------------|---------|
| `POSTGRES_PASSWORD` | A strong random password for the database | `a3f8b2c1d4e5...` |
| `JWT_SECRET` | A long random string for signing auth tokens (64+ chars) | `7c9d0e1f2a3b...` |
| `ADMIN_TOKEN` | Your initial admin login password | `5b8c3d2e1f0a...` |
| `CORS_ORIGINS` | Your domain, e.g. `https://keycontrol.example.com` | `https://example.com` |
| `DASHBOARD_PORT` | The port for the web dashboard (default `80`) | `80` |
| `GATEWAY_PORT` | The port for external API consumers (default `3001`) | `3001` |

#### 4. Build and start everything

```bash
# If you have npm installed:
npm run prod:up

# Or without npm — run docker compose directly:
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

This will:
1. Pull the base images (Node.js, PostgreSQL, Nginx) — first run takes 2–3 minutes
2. Build the backend and frontend images
3. Start PostgreSQL, wait for it to be healthy
4. Start the backend, wait for it to be healthy
5. Start Nginx (frontend + reverse proxy)

#### 5. Verify everything is running

```bash
# Check container status (all should show "Up" or "healthy")
docker compose -f docker-compose.prod.yml ps

# Check the API is responding
curl http://localhost/api
# Expected: {"status":"ok","version":"2.0.0","uptime":...}

# Check the frontend loads
curl -s http://localhost | head -3
# Expected: <!doctype html>...

# View live logs
docker compose -f docker-compose.prod.yml logs -f
```

#### 6. Open in your browser

Navigate to `http://your-server-ip` — you should see the KeyControl login page.

Log in with the `ADMIN_TOKEN` you set in step 3.

### Available Commands

| Command | What it does |
|---------|-------------|
| `npm run prod:up` | Build images and start all services |
| `npm run prod:down` | Stop all services (data is preserved) |
| `npm run prod:logs` | Tail logs from all services |
| `npm run prod:restart` | Restart all services |
| `npm run prod:reset` | ⚠️ **Destroy all data** and rebuild from scratch |

> **Without npm** — just replace `npm run prod:up` with the full `docker compose` command shown in step 4.

### Updating to a New Version

```bash
git pull                # Pull the latest code
npm run prod:up         # Rebuild and restart (data is preserved)
```

### SSL / HTTPS

The Docker setup serves HTTP on port 80. To add HTTPS, the easiest options:

**Option A — Caddy (auto-SSL, recommended for VPS):**

Install Caddy on the host and point it at your Docker stack:

```bash
# Install Caddy (Ubuntu/Debian)
sudo apt install -y caddy

# Edit /etc/caddy/Caddyfile:
keycontrol.example.com {
    reverse_proxy localhost:80
}

# Restart Caddy — it auto-obtains a Let's Encrypt certificate
sudo systemctl restart caddy
```

Then update `DASHBOARD_PORT=8080` in `.env.production` (so Caddy on port 80 proxies to Nginx on 8080).

**Option B — Cloud load balancer:**

If using AWS, put an ALB/CloudFront in front. On DigitalOcean, use their load balancer. These terminate SSL for you.