/**
 * Centralized application error class.
 *
 * Every operational error thrown across the API should be an AppError
 * (or be converted into one by the global error handler).
 */
export class AppError extends Error {
  /**
   * @param {string}  message     – Human-readable error message
   * @param {number}  statusCode  – HTTP status code
   * @param {string}  code        – Machine-readable error code (e.g. "VALIDATION_ERROR")
   * @param {object}  [options]
   * @param {*}       [options.details]       – Safe details (e.g. field-level validation errors)
   * @param {boolean} [options.isOperational] – true for expected/recoverable errors (default true)
   */
  constructor(
    message,
    statusCode,
    code,
    { details, isOperational = true } = {},
  ) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = isOperational;
  }

  // ── Static factory helpers ───────────────────────────────────────────

  /** 400 – Validation error with field-level details. */
  static validation(details) {
    return new AppError("Validation failed", 400, "VALIDATION_ERROR", {
      details,
    });
  }

  /** 400 – Generic bad request. */
  static badRequest(message = "Bad request", details) {
    return new AppError(message, 400, "BAD_REQUEST", { details });
  }

  /** 401 – Authentication required / invalid credentials. */
  static unauthorized(message = "Authentication required") {
    return new AppError(message, 401, "UNAUTHORIZED");
  }

  /** 403 – Insufficient permissions. */
  static forbidden(message = "Insufficient permissions") {
    return new AppError(message, 403, "FORBIDDEN");
  }

  /** 404 – Resource not found. */
  static notFound(message = "Resource not found") {
    return new AppError(message, 404, "NOT_FOUND");
  }

  /** 405 – Method not allowed. */
  static methodNotAllowed(message = "Method not allowed") {
    return new AppError(message, 405, "METHOD_NOT_ALLOWED");
  }

  /** 409 – Conflict (duplicate resource, etc.). */
  static conflict(message = "Resource conflict") {
    return new AppError(message, 409, "CONFLICT");
  }

  /** 500 – Unexpected internal error (marks isOperational = false). */
  static internal(message = "Internal server error") {
    return new AppError(message, 500, "INTERNAL_ERROR", {
      isOperational: false,
    });
  }

  /** 502 – Upstream / gateway error (remote service unreachable or misbehaving). */
  static badGateway(message = "Bad gateway", details) {
    return new AppError(message, 502, "BAD_GATEWAY", { details });
  }

  /** 504 – Gateway timeout. */
  static gatewayTimeout(message = "Gateway timeout", details) {
    return new AppError(message, 504, "GATEWAY_TIMEOUT", { details });
  }

  /** 413 – Payload too large. */
  static payloadTooLarge(message = "Payload too large") {
    return new AppError(message, 413, "PAYLOAD_TOO_LARGE");
  }
}
