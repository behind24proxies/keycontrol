/**
 * Unit tests for error handling middleware.
 *
 * Tests errorHandler, notFoundHandler, and asyncCatch using a minimal
 * Express app with no real database. This verifies the centralized error
 * pipeline produces consistent JSON responses.
 */
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import request from "supertest";
import express from "express";
import { AppError } from "../../../src/errors/AppError.js";
import { errorHandler } from "../../../src/middleware/errorHandler.js";
import { notFoundHandler } from "../../../src/middleware/notFoundHandler.js";
import { asyncCatch } from "../../../src/middleware/asyncCatch.js";
import { config } from "../../../src/config/index.js";

describe("Error Handling Middleware", () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());

    // Route that throws a known AppError
    app.get(
      "/known-error",
      asyncCatch(async () => {
        throw AppError.notFound("Widget not found");
      }),
    );

    // Route that throws an unexpected Error
    app.get(
      "/unexpected-error",
      asyncCatch(async () => {
        throw new Error("Something broke unexpectedly");
      }),
    );

    // Route that throws a ZodError-like validation error
    app.post(
      "/validation-error",
      asyncCatch(async () => {
        const { z } = await import("zod");
        z.object({ name: z.string().min(1) }).parse({ name: "" });
      }),
    );

    app.use(notFoundHandler);
    app.use(errorHandler);
  });

  afterEach(() => {
    // Reset to development after each test
    config.nodeEnv = "development";
  });

  // ── notFoundHandler ──────────────────────────────────────────────

  /**
   * Rationale: Any request to an unregistered route should return
   * a 404 with the standard error shape, not a blank response.
   */
  it("returns 404 with NOT_FOUND code for unmatched routes", async () => {
    const res = await request(app).get("/nonexistent");

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("NOT_FOUND");
    expect(res.body.error).toMatch(/not found/i);
  });

  // ── AppError pass-through ────────────────────────────────────────

  /**
   * Rationale: Known operational errors (thrown as AppError) should
   * preserve their statusCode and code without modification.
   */
  it("passes through AppError with correct status and code", async () => {
    const res = await request(app).get("/known-error");

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("NOT_FOUND");
    expect(res.body.error).toBe("Widget not found");
  });

  // ── Unexpected errors → 500 ──────────────────────────────────────

  /**
   * Rationale: Unexpected errors must be caught and normalized to 500
   * INTERNAL_ERROR. Details should NOT leak in production.
   */
  it("converts unexpected errors to 500 INTERNAL_ERROR", async () => {
    const res = await request(app).get("/unexpected-error");

    expect(res.status).toBe(500);
    expect(res.body.code).toBe("INTERNAL_ERROR");
    // details should not be present for non-operational errors
    expect(res.body.details).toBeUndefined();
  });

  // ── ZodError → validation ────────────────────────────────────────

  /**
   * Rationale: Zod validation errors thrown from route handlers should
   * be automatically converted into 400 VALIDATION_ERROR responses
   * with a details array.
   */
  it("converts ZodError into 400 VALIDATION_ERROR with details", async () => {
    const res = await request(app).post("/validation-error").send({});

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
    expect(res.body.details).toBeDefined();
    expect(Array.isArray(res.body.details)).toBe(true);
  });

  // ── Stack trace visibility ───────────────────────────────────────

  /**
   * Rationale: Stack traces in development help debugging. They must
   * be stripped in production to prevent information leakage.
   */
  it("includes stack trace in development mode", async () => {
    config.nodeEnv = "development";
    const res = await request(app).get("/unexpected-error");

    expect(res.status).toBe(500);
    expect(res.body.stack).toBeDefined();
  });

  it("excludes stack trace in production mode", async () => {
    config.nodeEnv = "production";
    const res = await request(app).get("/unexpected-error");

    expect(res.status).toBe(500);
    expect(res.body.stack).toBeUndefined();
    // Message should be generic in production
    expect(res.body.error).toBe("Internal server error");
  });

  // ── asyncCatch ───────────────────────────────────────────────────

  /**
   * Rationale: asyncCatch wraps async handlers so rejected promises
   * flow into next() instead of crashing the process. Without it,
   * unhandled rejections would cause 500s with no response body.
   */
  it("asyncCatch forwards rejected promises to error handler", async () => {
    const res = await request(app).get("/unexpected-error");
    // If asyncCatch wasn't working, this would hang or crash
    expect(res.status).toBe(500);
    expect(res.body.code).toBe("INTERNAL_ERROR");
  });
});
