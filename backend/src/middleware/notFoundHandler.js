import { AppError } from "../errors/AppError.js";

/**
 * 404 handler — placed after all routes.
 * Delegates to the global error handler via next().
 */
export function notFoundHandler(req, _res, next) {
  next(AppError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
}
