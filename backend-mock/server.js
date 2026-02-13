import express from 'express';
import cors from 'cors';
import { Database } from './db/sqlite-wrapper.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initDatabase } from './db/init.js';
import { mockApiRouter } from './routes/mock-api.js';
import { masterKeyRouter } from './routes/master-key.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.set('trust proxy', true);
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Initialize database and start server
async function startServer() {
  const db = new Database(join(__dirname, 'mock-server.db'));
  await db.ready();
  initDatabase(db);

  // Make db available to routes
  app.locals.db = db;

  // Routes
  app.use('/api/master-key', masterKeyRouter);
  app.use('/api', mockApiRouter);

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ success: true, message: 'Mock server is running', port: PORT });
  });

  const server = app.listen(PORT, () => {
    console.log(`Mock API Server running on http://localhost:${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n❌ Port ${PORT} is already in use.`);
      console.error(`   Please stop the process using this port or use a different port.`);
      console.error(`   To find the process: netstat -ano | findstr :${PORT}`);
      console.error(`   To kill it: taskkill /PID <PID> /F\n`);
    } else {
      console.error('Server error:', err);
    }
    process.exit(1);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...');
    server.close(() => {
      console.log('Server closed');
      db.close();
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    console.log('\nSIGINT received, shutting down gracefully...');
    server.close(() => {
      console.log('Server closed');
      db.close();
      process.exit(0);
    });
  });
}

startServer().catch(console.error);
