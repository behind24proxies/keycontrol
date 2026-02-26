/**
 * Unit tests for rate limit validators.
 *
 * Rate limits protect external APIs from overuse. Correct validation
 * ensures admins can only create meaningful rate limit configurations.
 */
import { describe, it, expect } from "vitest";
import {
  createRateLimitSchema,
  updateRateLimitSchema,
} from "../../../src/validators/rate-limits.js";

describe("Rate Limit Validators", () => {
  // ═══════════════════════════════════════════════════════════════════
  // createRateLimitSchema
  // ═══════════════════════════════════════════════════════════════════
  describe("createRateLimitSchema", () => {
    /**
     * Rationale: The only true required field is name. Rules default
     * to an empty array.
     */
    it("passes with just a name", () => {
      const result = createRateLimitSchema.safeParse({
        body: { name: "Basic Limit" },
      });
      expect(result.success).toBe(true);
      expect(result.data.body.rules).toEqual([]);
    });

    /**
     * Rationale: Rules must have positive integers for both requests
     * and window_seconds — zero or negative values are illogical.
     */
    it("passes with valid rules array", () => {
      const result = createRateLimitSchema.safeParse({
        body: {
          name: "Standard",
          rules: [
            { requests: 100, window_seconds: 60 },
            { requests: 1000, window_seconds: 3600 },
          ],
        },
      });
      expect(result.success).toBe(true);
    });

    it("rejects rules with non-positive requests", () => {
      const result = createRateLimitSchema.safeParse({
        body: {
          name: "Bad",
          rules: [{ requests: 0, window_seconds: 60 }],
        },
      });
      expect(result.success).toBe(false);
    });

    it("rejects rules with non-positive window_seconds", () => {
      const result = createRateLimitSchema.safeParse({
        body: {
          name: "Bad",
          rules: [{ requests: 100, window_seconds: -1 }],
        },
      });
      expect(result.success).toBe(false);
    });

    /**
     * Rationale: response_body should default. response_code and
     * response_type are system-locked (controller-level, not schema).
     */
    it("applies default response_body", () => {
      const result = createRateLimitSchema.safeParse({
        body: { name: "Defaults" },
      });
      expect(result.success).toBe(true);
      expect(result.data.body.response_body).toBe('{"error": "Rate limit exceeded"}');
    });

    /**
     * Rationale: Empty name would create an unidentifiable rate limit.
     */
    it("rejects empty name", () => {
      const result = createRateLimitSchema.safeParse({
        body: { name: "" },
      });
      expect(result.success).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // updateRateLimitSchema
  // ═══════════════════════════════════════════════════════════════════
  describe("updateRateLimitSchema", () => {
    /**
     * Rationale: Update requires params.id and at least a name.
     */
    it("passes with valid params and body", () => {
      const result = updateRateLimitSchema.safeParse({
        params: { id: "1" },
        body: {
          name: "Updated Limit",
          rules: [{ requests: 50, window_seconds: 30 }],
        },
      });
      expect(result.success).toBe(true);
    });
  });
});
