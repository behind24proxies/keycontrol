import express from "express";
import cors from "cors";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { join, dirname } from "path";
import { config } from "./config/index.js";
import morgan from "morgan";
import { apiReference } from "@scalar/express-api-reference";

import apiRouter from "./routes/index.js";
import gatewayRouter from "./routes/gateway.js";
import { notFoundHandler } from "./middleware/notFoundHandler.js";
import { errorHandler } from "./middleware/errorHandler.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const openapiSpec = readFileSync(join(__dirname, "../openapi.yaml"), "utf8");

/**
 * Create and configure the Express application.
 * Accepts an optional `db` override (used in tests).
 */
export function createApp() {
  const app = express();

  // ── Core middleware ─────────────────────────────────────────────────
  app.set("trust proxy", true);
  
  // Custom CORS middleware to dynamically allow same-host requests
  app.use((req, res, next) => {
    cors({
      origin: (origin, callback) => {
        // 1. Allow if no origin (server-to-server, curl, Postman)
        if (!origin) return callback(null, true);
        
        // 2. Allow if explicitly listed in CORS_ORIGINS
        if (config.corsOrigins.includes(origin)) return callback(null, true);
        
        // 3. Allow if same-host (origin matches the Host header)
        // This makes zero-config Docker deployments work automatically.
        try {
          const originUrl = new URL(origin);
          const host = req.get("host"); // e.g. "example.com:8080" or "example.com"
          if (host && host.startsWith(originUrl.hostname)) {
            return callback(null, true);
          }
        } catch (e) { /* ignore parse errors */ }

        callback(new Error('Not allowed by CORS'));
      }
    })(req, res, next);
  });
  if (config.isDev) {
    app.use(morgan("dev"));
  }
  // ── API Docs (Scalar) ────────────────────────────────────────────────
  app.get("/openapi.yaml", (req, res) => {
    const protocol = req.protocol;
    const host = req.get("host");
    const origin = `${protocol}://${host}`;
    const dynamicSpec = openapiSpec
      .replace(/\{scheme\}:\/\/\{host\}:\{port\}/g, origin);
    res.type("text/yaml").send(dynamicSpec);
  });
  app.use(
    "/docs",
    apiReference({
      spec: { url: "/openapi.yaml" },
      theme: "default",
    }),
  );

  // ── Routes ──────────────────────────────────────────────────────────
  // Health check — public, no auth required
  app.get("/api", (_req, res) => {
    res.json({
      status: "ok",
      version: "2.0.0",
      uptime: Math.floor(process.uptime()),
    });
  });

  // Body parsers only for /api routes — gateway handles raw bodies itself
  app.use(
    "/api",
    express.json({ limit: "50mb" }),
    express.urlencoded({ extended: true, limit: "50mb" }),
    apiRouter,
  );
  app.use("/gateway", gatewayRouter); // Gateway (proxy) routes — uses API keys, not JWT

  // ── Error handling ──────────────────────────────────────────────────
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
