import { ZodError } from "zod";
import { AppError } from "../errors/AppError.js";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";

/**
 * Global Express error handler.
 * Must be the LAST middleware registered and must have 4 parameters.
 *
 * - Converts ZodError → AppError.validation
 * - Converts unknown errors → AppError.internal
 * - Logs with environment-aware verbosity
 * - Returns a consistent JSON response shape
 */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  // ── Normalise to AppError ──────────────────────────────────────────
  let appError;

  if (err instanceof AppError) {
    appError = err;
  } else if (err instanceof SyntaxError && err.status === 400) {
    // Express body-parser SyntaxError (malformed JSON)
    appError = AppError.badRequest(err.message);
  } else if (err.type === "entity.too.large") {
    // express.raw() / express.json() payload exceeds limit
    appError = AppError.payloadTooLarge(
      "Request body exceeds the allowed size limit",
    );
  } else if (err.type === "request.aborted") {
    // Client disconnected mid-upload
    appError = AppError.badRequest("Request aborted by client");
  } else if (err instanceof ZodError) {
    const details = err.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));
    appError = AppError.validation(details);
  } else {
    // Unknown / unexpected error
    appError = AppError.internal(
      config.isDev ? err.message : "Internal server error",
    );
    appError.isOperational = false;
    // Preserve the original stack for logging
    appError.stack = err.stack;
  }

  // ── Logging ────────────────────────────────────────────────────────
  logger.requestError(appError, req);

  // ── Response ───────────────────────────────────────────────────────
  const body = {
    error: appError.message,
    code: appError.code,
  };

  // Include details only for operational errors that carry them
  if (appError.isOperational && appError.details !== undefined) {
    body.details = appError.details;
  }

  // Include stack only in development
  if (config.isDev) {
    body.stack = appError.stack;
  }

  res.status(appError.statusCode).json(body);
}
