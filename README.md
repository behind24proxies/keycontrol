# KeyControl - API Gateway

A full-stack API gateway for managing and splitting API keys with JWT authentication, rate limiting, IP blocking, and endpoint restrictions.

## Features

- **JWT Authentication**: Secure account login / signup with bcrypt password hashing and Bearer tokens
- **Projects Management**: Create projects with unique paths and external API URLs
- **Endpoint Groups**: Organize endpoints with URL patterns and HTTP methods
- **API Keys**: Generate virtual keys (format: `um-{code}-{random}`) with:
  - Rate limiting
  - IP blocklists / allowlists
  - Method restrictions
  - Endpoint group restrictions
  - User details / notes
- **IP Blocklists & Allowlists**: Global IP rules with custom response codes
- **Rate Limits**: Sliding-window rate limits with multiple rules (e.g., 10/sec, 100/min)
- **Request Logging**: View all requests and responses with filtering
- **Gateway**: Automatic key replacement and request forwarding
- **2FA**: Optional TOTP two-factor authentication via authenticator apps

## Tech Stack

- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Express.js (ESM), better-sqlite3, JWT, Zod, bcryptjs
- **Database**: SQLite (WAL mode via better-sqlite3)
- **Testing**: Vitest + Supertest

## Quick Start

### Prerequisites

- Node.js 18+
- npm 9+

### Using the root dev script (recommended)

```bash
npm install         # installs root, backend & frontend deps
npm run dev         # starts both backend and frontend concurrently
```

### Manual setup

```bash
# Backend
cd backend
cp .env.example .env   # edit JWT_SECRET for production!
npm install
npm run dev             # http://localhost:3001

# Frontend (separate terminal)
cd frontend
npm install
npm run dev             # http://localhost:5173
```

## Environment Variables

| Variable         | Default                 | Description                       |
| ---------------- | ----------------------- | --------------------------------- |
| `PORT`           | `3001`                  | Server port                       |
| `DB_PATH`        | `./data/keysplitter.db` | SQLite database file              |
| `JWT_SECRET`     | `dev-secret-change-me`  | **Must** be changed in production |
| `JWT_EXPIRES_IN` | `24h`                   | Token expiry (e.g. `1h`, `7d`)    |
| `CORS_ORIGINS`   | `http://localhost:5173` | Comma-separated allowed origins   |
| `BCRYPT_ROUNDS`  | `12`                    | Password hash rounds              |

## Usage

1. **Sign up**: Create an account at `/login`
2. **Create a Project**: Add name, unique path, secret API key, and the external API URL to proxy
3. **Add Endpoint Groups**: Restrict which URL patterns and methods are allowed
4. **Create API Keys**: Generate virtual keys with rate limits, IP rules, and method restrictions
5. **Use the Gateway**: Make requests to:
   ```
   http://localhost:3001/{unique_path}?url=https://external-api.com/endpoint
   ```
   Include your virtual key (`um-...`) in headers, body, or query params. It is automatically swapped for the real secret key before forwarding.

## API Endpoints

All protected routes require `Authorization: Bearer <token>`.

### Auth (public)

- `POST /api/auth/login` — Login, returns JWT
- `POST /api/auth/signup` — Register, returns JWT

### Account

- `GET    /api/account/profile`
- `PUT    /api/account/account-code`
- `POST   /api/account/change-password`
- `POST   /api/account/2fa/generate`
- `POST   /api/account/2fa/verify`
- `DELETE /api/account/2fa`
- `PUT    /api/account/session-timeout`
- `PUT    /api/account/ip-logging`

### Projects

- `GET    /api/projects`
- `POST   /api/projects`
- `GET    /api/projects/:id`
- `PUT    /api/projects/:id`
- `DELETE /api/projects/:id`

### Endpoint Groups

- `GET    /api/projects/:projectId/endpoint-groups`
- `POST   /api/projects/:projectId/endpoint-groups`
- `PUT    /api/endpoint-groups/:id`
- `DELETE /api/endpoint-groups/:id`

### API Keys

- `GET    /api/projects/:projectId/api-keys`
- `POST   /api/projects/:projectId/api-keys`
- `PUT    /api/api-keys/:id`
- `DELETE /api/api-keys/:id`

### IP Blocklists / Allowlists

- `GET / POST / PUT / DELETE /api/ip-blocklists[/:id]`
- `GET / POST / PUT / DELETE /api/ip-allowlists[/:id]`

### Rate Limits

- `GET / POST / PUT / DELETE /api/rate-limits[/:id]`

### Users

- `GET / POST / PUT / DELETE /api/users[/:id]`

### Logs

- `GET /api/logs` — supports `project_id` and `api_key_id` query params

## Testing

```bash
cd backend
npm test            # run once
npm run test:watch  # watch mode
```

## Project Structure

```
backend/
  src/
    config/         # Environment configuration
    db/             # Database init + schema
    middleware/     # auth, validate, error-handler
    routes/         # Modular Express routers
    services/       # Rate limiter
    utils/          # Crypto helpers
    validators/     # Zod schemas
    app.js          # Express app factory
    server.js       # Entry point
  tests/            # Vitest test suite
frontend/
  src/
    components/     # UI components (shadcn/ui)
    lib/            # API client, auth, utils
    pages/          # Route pages
```

## Default Rate Limit

A default rate limit is automatically seeded:

- 10 requests per second
- 100 requests per 60 seconds
