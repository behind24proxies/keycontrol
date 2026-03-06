import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, "../../.env") });

export const config = {
  port: parseInt(process.env.PORT || "3001", 10),
  nodeEnv: process.env.NODE_ENV || "development",

  // Database — use DATABASE_URL for any environment
  databaseUrl:
    process.env.DATABASE_URL ||
    "postgresql://postgres:postgres@localhost:5433/keycontrol",

  // JWT (used for admin dashboard sessions)
  jwtSecret: process.env.JWT_SECRET || "dev-jwt-secret-change-in-production",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "1h",

  // Admin authentication — initial seed token (only used on first boot)
  adminToken: process.env.ADMIN_TOKEN || "",

  // Password reset — set this env var only when admin needs to recover
  resetHash: process.env.RESET_HASH || "",

  // CORS
  corsOrigins: process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(",").map((s) => s.trim())
    : ["http://localhost:3000"],

  // Frontend URL
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",

  // Log retention — how long to keep request logs (in seconds, default 30 days)
  logRetentionSeconds: parseInt(process.env.LOG_RETENTION_SECONDS || "2592000", 10),

  // Log buffer tuning
  logFlushIntervalMs: parseInt(process.env.LOG_FLUSH_INTERVAL_MS || "2000", 10),
  logMaxBatchSize: parseInt(process.env.LOG_MAX_BATCH_SIZE || "200", 10),
  logMaxBufferCap: parseInt(process.env.LOG_MAX_BUFFER_CAP || "10000", 10),

  get isDev() {
    return this.nodeEnv === "development";
  },
  get isProd() {
    return this.nodeEnv === "production";
  },
};

// Safety: require JWT_SECRET in production
if (config.isProd && !process.env.JWT_SECRET) {
  console.error(
    "FATAL: JWT_SECRET environment variable must be set in production",
  );
  process.exit(1);
}

// Safety: warn if ADMIN_TOKEN is not set in production
// (actual enforcement happens in schema seed — only required on first boot)
if (config.isProd && !process.env.ADMIN_TOKEN) {
  console.warn(
    "WARNING: ADMIN_TOKEN is not set. It is only required on first boot to seed the admin password. " +
    "If the password has already been set in the database, this warning can be ignored.",
  );
}
