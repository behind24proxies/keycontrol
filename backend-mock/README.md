# Mock API Server

Mock backend server running on port 3002 for testing virtual keys and API functionality.

## Setup

```bash
cd backend-mock
npm install
npm start
```

## Endpoints

### Master API Key Management

- `POST /api/master-key` - Create a new master API key
- `GET /api/master-key` - Get all master keys (masked)
- `GET /api/master-key/:id` - Get specific master key (full)
- `PUT /api/master-key/:id/regenerate` - Regenerate a specific master key
- `PUT /api/master-key/regenerate` - Regenerate all active master keys
- `DELETE /api/master-key/:id` - Delete a master key
- `PUT /api/master-key/:id/activate` - Activate a master key
- `PUT /api/master-key/:id/deactivate` - Deactivate a master key
- `POST /api/master-key/validate` - Validate a master key

### Virtual Keys & Mock API

- `GET /api/keys` - Get all virtual keys
- `POST /api/keys` - Create a virtual key
- `GET /api/keys/:id` - Get a specific virtual key
- `PUT /api/keys/:id` - Update a virtual key
- `DELETE /api/keys/:id` - Delete a virtual key
- `POST /api/keys/:id/activate` - Activate a key
- `POST /api/keys/:id/deactivate` - Deactivate a key
- `GET /api/users` - Get all users
- `POST /api/users` - Create a user
- `GET /api/projects` - Get all projects
- `POST /api/projects` - Create a project
- `GET /api/stats` - Get statistics
- `POST /api/validate` - Validate a key

### Health Check

- `GET /health` - Server health check

## Database

SQLite database file: `mock-server.db`

Tables:
- `master_api_keys` - Master API keys
- `virtual_keys` - Virtual keys for testing
- `mock_users` - Mock user data
- `mock_projects` - Mock project data
- `api_logs` - API request logs
