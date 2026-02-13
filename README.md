# KeySplitter - API Gateway

A full-stack API gateway solution for managing and splitting API keys with rate limiting, IP blocking, and endpoint restrictions.

## Features

- **Projects Management**: Create projects with unique paths and external API URLs
- **Endpoint Groups**: Organize endpoints with URL patterns and HTTP methods
- **API Keys**: Generate virtual keys (format: `vk-or-pk-{random}`) with:
  - Rate limiting
  - IP blocklists
  - Method restrictions
  - Endpoint group restrictions
  - User details/notes
- **IP Blocklists**: Global IP blocking with custom response codes and bodies
- **Rate Limits**: Global rate limits with multiple rules (e.g., 10/sec, 100/min)
- **Request Logging**: View all requests and responses with filtering
- **Gateway**: Automatic key replacement and request forwarding

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Express.js, SQLite (sql.js - pure JavaScript)
- **Database**: SQLite (no native compilation required)

## Setup

### Backend

```bash
cd backend
npm install
npm run dev  # Development mode with hot reload
# or
npm start    # Production mode
```

The backend will run on `http://localhost:3001` and automatically restart on file changes.

### Frontend

```bash
cd frontend
npm install
npm run dev  # Development mode with hot reload
```

The frontend will run on `http://localhost:3000` with automatic hot reload on file changes.

## Usage

1. **Create a Project**: Go to the Projects page and create a new project with:
   - Name
   - Unique path (e.g., `myapi`)
   - Secret API key (the real key to protect)
   - External API URL

2. **Add Endpoint Groups**: In the project detail page, create endpoint groups with URL patterns and methods

3. **Create API Keys**: Generate virtual keys with restrictions and rate limits

4. **Use the Gateway**: Make requests to:
   ```
   http://localhost:3001/{unique_path}?url=https://external-api.com/endpoint
   ```
   
   Include your virtual key (`vk-or-pk-...`) anywhere in headers, body, or query params. It will be automatically replaced with the secret key before forwarding.

## API Endpoints

### Projects
- `GET /api/projects` - List all projects
- `POST /api/projects` - Create project
- `GET /api/projects/:id` - Get project details
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project

### API Keys
- `GET /api/projects/:projectId/api-keys` - List API keys
- `POST /api/projects/:projectId/api-keys` - Create API key
- `PUT /api/api-keys/:id` - Update API key
- `DELETE /api/api-keys/:id` - Delete API key

### Rate Limits
- `GET /api/rate-limits` - List rate limits
- `POST /api/rate-limits` - Create rate limit
- `PUT /api/rate-limits/:id` - Update rate limit
- `DELETE /api/rate-limits/:id` - Delete rate limit

### IP Blocklists
- `GET /api/ip-blocklists` - List blocklists
- `POST /api/ip-blocklists` - Create blocklist
- `PUT /api/ip-blocklists/:id` - Update blocklist
- `DELETE /api/ip-blocklists/:id` - Delete blocklist

### Logs
- `GET /api/logs` - Get request logs (supports `project_id` and `api_key_id` query params)

## Gateway

The gateway automatically:
- Validates API keys
- Checks IP blocklists
- Enforces rate limits
- Validates method and endpoint restrictions
- Replaces virtual keys with secret keys
- Forwards requests to external APIs
- Logs all requests and responses

## Default Rate Limit

A default rate limit is automatically created with:
- 10 requests per second
- 100 requests per 60 seconds
