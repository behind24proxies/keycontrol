# Setup Instructions

## Prerequisites

No special requirements! The project uses pure JavaScript libraries that don't require any native compilation or build tools.

## Quick Start

1. **Install Backend Dependencies:**
   ```bash
   cd backend
   npm install
   ```

2. **Install Frontend Dependencies:**
   ```bash
   cd frontend
   npm install
   ```

3. **Start Backend (Development):**
   ```bash
   cd backend
   npm run dev
   ```
   Server runs on `http://localhost:3001`

4. **Start Frontend (Development):**
   ```bash
   cd frontend
   npm run dev
   ```
   Frontend runs on `http://localhost:3000`

## Troubleshooting

### "Could not find Visual Studio installation"

Install Visual Studio Build Tools (see Prerequisites above).

### "EPERM: operation not permitted"

Close any programs that might be using the node_modules folder (like VS Code, file explorers) and try again.

### Frontend: "'next' is not recognized"

Make sure you ran `npm install` in the frontend directory first.
