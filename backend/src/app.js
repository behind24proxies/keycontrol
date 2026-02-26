import express from "express";
import cors from "cors";
import { config } from "./config/index.js";
import morgan from "morgan";

import apiRouter from "./routes/index.js";
import gatewayRouter from "./routes/gateway.js";
import { notFoundHandler } from "./middleware/notFoundHandler.js";
import { errorHandler } from "./middleware/errorHandler.js";

/**
 * Create and configure the Express application.
 * Accepts an optional `db` override (used in tests).
 */
export function createApp() {
  const app = express();

  // ── Core middleware ─────────────────────────────────────────────────
  app.set("trust proxy", true);
  app.use(cors({ origin: config.corsOrigins }));
  if (config.isDev) {
    app.use(morgan("dev"));
  }
  // ── Routes ──────────────────────────────────────────────────────────
  // Body parsers only for /api routes — gateway handles raw bodies itself
  app.use(
    "/api",
    express.json({ limit: "50mb" }),
    express.urlencoded({ extended: true, limit: "50mb" }),
    apiRouter,
  );
  app.use("/", gatewayRouter); // Gateway (proxy) routes — uses API keys, not JWT

  // ── Error handling ──────────────────────────────────────────────────
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
