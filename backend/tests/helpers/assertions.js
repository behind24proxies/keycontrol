/**
 * Reusable assertion helpers.
 *
 * These eliminate repetitive expect() chains and ensure every test validates
 * the API error response shape consistently.
 */
import { expect } from "vitest";

/**
 * Assert a standard API error response.
 * Verifies status code, error code, and message shape.
 *
 * @param {object} res   - Supertest response
 * @param {number} status - Expected HTTP status
 * @param {string} code   - Expected machine-readable error code (e.g. "VALIDATION_ERROR")
 */
export function expectApiError(res, status, code) {
  expect(res.status).toBe(status);
  expect(res.body.error).toBeDefined();
  expect(res.body.code).toBe(code);
}

/**
 * Assert a validation error with specific field details.
 *
 * @param {object}   res       - Supertest response
 * @param {string[]} [fields]  - Optional array of field paths that should appear in details
 */
export function expectValidationError(res, fields) {
  expectApiError(res, 400, "VALIDATION_ERROR");
  expect(res.body.details).toBeDefined();
  expect(Array.isArray(res.body.details)).toBe(true);
  expect(res.body.details.length).toBeGreaterThan(0);

  // Every detail entry must have a path and message
  for (const detail of res.body.details) {
    expect(detail).toHaveProperty("path");
    expect(detail).toHaveProperty("message");
  }

  // Check specific fields if provided
  if (fields) {
    const paths = res.body.details.map((d) => d.path);
    for (const field of fields) {
      expect(paths).toContain(field);
    }
  }
}

/**
 * Assert a successful response with optional status code.
 *
 * @param {object} res    - Supertest response
 * @param {number} [status=200] - Expected HTTP status
 */
export function expectSuccess(res, status = 200) {
  expect(res.status).toBe(status);
}

/**
 * Assert a 403 Forbidden response.
 *
 * @param {object} res - Supertest response
 */
export function expectForbidden(res) {
  expectApiError(res, 403, "FORBIDDEN");
}

/**
 * Assert a 401 Unauthorized response.
 *
 * @param {object} res - Supertest response
 */
export function expectUnauthorized(res) {
  expectApiError(res, 401, "UNAUTHORIZED");
}

/**
 * Assert a 404 Not Found response.
 *
 * @param {object} res - Supertest response
 */
export function expectNotFound(res) {
  expectApiError(res, 404, "NOT_FOUND");
}

/**
 * Assert a 409 Conflict response.
 *
 * @param {object} res - Supertest response
 */
export function expectConflict(res) {
  expectApiError(res, 409, "CONFLICT");
}

/**
 * Assert a 400 Bad Request response.
 *
 * @param {object} res - Supertest response
 */
export function expectBadRequest(res) {
  expectApiError(res, 400, "BAD_REQUEST");
}
