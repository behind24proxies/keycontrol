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

  // Admin authentication — single env-based token
  adminToken: process.env.ADMIN_TOKEN || "",

  // CORS
  corsOrigins: process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(",").map((s) => s.trim())
    : ["http://localhost:3000"],

  // Frontend URL
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",

  // Log retention — how long to keep request logs (in seconds, default 30 days)
  logRetentionSeconds: parseInt(process.env.LOG_RETENTION_SECONDS || "2592000", 10),

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

// Safety: require ADMIN_TOKEN in production
if (config.isProd && !process.env.ADMIN_TOKEN) {
  console.error(
    "FATAL: ADMIN_TOKEN environment variable must be set in production",
  );
  process.exit(1);
}
