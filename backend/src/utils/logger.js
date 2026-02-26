import { config } from "../config/index.js";

/**
 * Simple structured logger with environment-aware behavior.
 *
 * - development: all levels emit (debug, info, warn, error)
 * - production:  debug is suppressed
 */
export const logger = {
  debug(...args) {
    if (config.isDev) console.debug("[DEBUG]", ...args);
  },
  info(...args) {
    console.info("[INFO]", ...args);
  },
  warn(...args) {
    console.warn("[WARN]", ...args);
  },
  error(...args) {
    console.error("[ERROR]", ...args);
  },

  /**
   * Log an error in the context of an HTTP request.
   * Redacts sensitive headers and values automatically.
   */
  requestError(err, req) {
    const meta = {
      method: req.method,
      url: req.originalUrl,
      statusCode: err.statusCode || 500,
      code: err.code || "INTERNAL_ERROR",
      userId: req.user?.id ?? undefined,
    };

    const level = err.isOperational ? "warn" : "error";

    logger[level](`${meta.method} ${meta.url}`, meta, err.message);

    if (config.isDev && err.stack) {
      logger.debug(err.stack);
    }
  },
};
