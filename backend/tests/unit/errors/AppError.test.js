/**
 * Unit tests for the AppError class.
 *
 * AppError is the backbone of the centralized error-handling strategy.
 * Every API error flows through it, so these tests verify that each
 * static factory produces the correct statusCode, code, and options.
 */
import { describe, it, expect } from "vitest";
import { AppError } from "../../../src/errors/AppError.js";

describe("AppError", () => {
  // ── Constructor ────────────────────────────────────────────────────

  describe("constructor", () => {
    /**
     * Rationale: Verifies the base constructor correctly assigns all
     * properties. This is the foundation — if the constructor is broken,
     * every factory helper is broken.
     */
    it("sets all properties from constructor arguments", () => {
      const details = [{ path: "email", message: "required" }];
      const err = new AppError("Test error", 418, "TEST_CODE", { details });

      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(AppError);
      expect(err.message).toBe("Test error");
      expect(err.statusCode).toBe(418);
      expect(err.code).toBe("TEST_CODE");
      expect(err.details).toEqual(details);
      expect(err.isOperational).toBe(true);
      expect(err.name).toBe("AppError");
    });

    /**
     * Rationale: isOperational defaults to true for expected errors.
     * When explicitly set to false, it signals an unexpected crash that
     * should be logged differently.
     */
    it("defaults isOperational to true", () => {
      const err = new AppError("test", 400, "TEST");
      expect(err.isOperational).toBe(true);
    });

    it("respects isOperational = false for unexpected errors", () => {
      const err = new AppError("crash", 500, "CRASH", {
        isOperational: false,
      });
      expect(err.isOperational).toBe(false);
    });
  });

  // ── Static Factories ───────────────────────────────────────────────

  describe("static factory: validation()", () => {
    /**
     * Rationale: Validation errors are the most common error type in the API.
     * They must carry field-level details so the frontend can highlight
     * the exact fields that failed.
     */
    it("creates a 400 VALIDATION_ERROR with details array", () => {
      const details = [{ path: "email", message: "required" }];
      const err = AppError.validation(details);

      expect(err.statusCode).toBe(400);
      expect(err.code).toBe("VALIDATION_ERROR");
      expect(err.details).toEqual(details);
      expect(err.isOperational).toBe(true);
      expect(err.message).toBe("Validation failed");
    });
  });

  describe("static factory: badRequest()", () => {
    /**
     * Rationale: Generic 400 for business logic errors that aren't
     * field-validation failures (e.g. "cannot delete the last admin").
     */
    it("creates a 400 BAD_REQUEST with custom message", () => {
      const err = AppError.badRequest("Invalid operation");
      expect(err.statusCode).toBe(400);
      expect(err.code).toBe("BAD_REQUEST");
      expect(err.message).toBe("Invalid operation");
    });

    it("uses default message when none is provided", () => {
      const err = AppError.badRequest();
      expect(err.message).toBe("Bad request");
    });
  });

  describe("static factory: unauthorized()", () => {
    /**
     * Rationale: 401 errors trigger login redirects in the frontend.
     * Must produce the correct code so the frontend can distinguish
     * "not logged in" from "wrong permissions".
     */
    it("creates a 401 UNAUTHORIZED", () => {
      const err = AppError.unauthorized();
      expect(err.statusCode).toBe(401);
      expect(err.code).toBe("UNAUTHORIZED");
      expect(err.isOperational).toBe(true);
    });

    it("accepts a custom message", () => {
      const err = AppError.unauthorized("Token expired");
      expect(err.message).toBe("Token expired");
    });
  });

  describe("static factory: forbidden()", () => {
    /**
     * Rationale: 403 is used for RBAC enforcement. Admin-only routes
     * return this for limited users. Critical for security.
     */
    it("creates a 403 FORBIDDEN", () => {
      const err = AppError.forbidden();
      expect(err.statusCode).toBe(403);
      expect(err.code).toBe("FORBIDDEN");
    });
  });

  describe("static factory: notFound()", () => {
    /**
     * Rationale: Used both by the 404 handler middleware and by
     * controllers when a specific resource is missing.
     */
    it("creates a 404 NOT_FOUND with custom message", () => {
      const err = AppError.notFound("Widget not found");
      expect(err.statusCode).toBe(404);
      expect(err.code).toBe("NOT_FOUND");
      expect(err.message).toBe("Widget not found");
    });
  });

  describe("static factory: conflict()", () => {
    /**
     * Rationale: 409 is returned for duplicate resources (e.g. duplicate
     * email on invite, duplicate key delegation). Important for idempotency.
     */
    it("creates a 409 CONFLICT", () => {
      const err = AppError.conflict("Already exists");
      expect(err.statusCode).toBe(409);
      expect(err.code).toBe("CONFLICT");
      expect(err.message).toBe("Already exists");
    });
  });

  describe("static factory: internal()", () => {
    /**
     * Rationale: 500 errors are marked as non-operational, which tells
     * the error handler to NOT expose details in production. This is a
     * critical security boundary.
     */
    it("creates a 500 INTERNAL_ERROR marked as non-operational", () => {
      const err = AppError.internal();
      expect(err.statusCode).toBe(500);
      expect(err.code).toBe("INTERNAL_ERROR");
      expect(err.isOperational).toBe(false);
    });
  });

  describe("static factory: badGateway()", () => {
    /**
     * Rationale: The gateway controller proxies requests to external APIs.
     * When the upstream service fails, we need a 502.
     */
    it("creates a 502 BAD_GATEWAY", () => {
      const err = AppError.badGateway("Upstream unreachable");
      expect(err.statusCode).toBe(502);
      expect(err.code).toBe("BAD_GATEWAY");
    });
  });

  describe("static factory: gatewayTimeout()", () => {
    /**
     * Rationale: Upstream timeouts need to be distinguished from internal
     * 500s so the frontend can show a meaningful message.
     */
    it("creates a 504 GATEWAY_TIMEOUT", () => {
      const err = AppError.gatewayTimeout();
      expect(err.statusCode).toBe(504);
      expect(err.code).toBe("GATEWAY_TIMEOUT");
    });
  });

  describe("static factory: payloadTooLarge()", () => {
    /**
     * Rationale: The gateway accepts request bodies to proxy. If they
     * exceed limits, we need a clear 413.
     */
    it("creates a 413 PAYLOAD_TOO_LARGE", () => {
      const err = AppError.payloadTooLarge();
      expect(err.statusCode).toBe(413);
      expect(err.code).toBe("PAYLOAD_TOO_LARGE");
    });
  });
});
