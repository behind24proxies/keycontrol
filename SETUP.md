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
│   Port 8080 → Nginx                                          │
│               ├── /api/*       → Backend (admin REST API)    │
│               ├── /gateway/*   → Backend (gateway proxy)     │
│               ├── /docs        → Backend (API documentation) │
│               └── /*           → Frontend SPA                │
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

### Firewall Configuration

Before deploying, ensure your VPS firewall (e.g., UFW, AWS Security Group, DigitalOcean Firewall) allows incoming traffic on:
- **`80`** (HTTP - Dashboard / API / Gateway)
- **`443`** (HTTPS - if setting up SSL)


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
| `DASHBOARD_PORT` | The port for the web interface (default `8080`) | `8080` |

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
curl http://localhost:8080/api
# Expected: {"status":"ok","version":"2.0.0","uptime":...}

# Check the frontend loads
curl -s http://localhost:8080 | head -3
# Expected: <!doctype html>...

# View live logs
docker compose -f docker-compose.prod.yml logs -f
```

#### 6. Open in your browser

Navigate to `http://your-server-ip:8080` — you should see the KeyControl login page.

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

The Docker setup serves HTTP on port `8080`. To add HTTPS and serve on standard web ports, the easiest options:

**Option A — Caddy (auto-SSL, recommended for VPS):**

Because the Docker stack runs on port `8080` by default, port `80` is completely free. You can install Caddy and point it at the Docker container without any downtime or conflicts:

```bash
# 1. Install Caddy (Ubuntu/Debian official repo)
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy

# 2. Edit /etc/caddy/Caddyfile:
your-domain.example.com {
    reverse_proxy localhost:8080
}

# 3. Restart Caddy — it auto-obtains a Let's Encrypt certificate
sudo systemctl restart caddy
```

**Option B — Cloud load balancer:**

If using AWS, put an ALB/CloudFront in front. On DigitalOcean, use their load balancer. These terminate SSL for you.