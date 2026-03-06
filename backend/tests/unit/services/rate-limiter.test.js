/**
 * Unit tests for the RateLimiter service.
 *
 * The rate limiter is a sliding-window counter keyed by preset/use-case.
 * It queries rate_limit_rules from the database to determine limits, then
 * tracks request timestamps in memory. These tests use a mock DB that
 * returns canned rules, making them true unit tests.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { rateLimiter } from "../../../src/services/rate-limiter.js";

/**
 * Mock DB that returns canned rate_limit_rules when queried.
 * The `check` method calls db.all("SELECT * FROM rate_limit_rules WHERE rate_limit_id = $1", [id])
 */
function mockDb(rules = []) {
  return {
    async all(_sql, params) {
      // Filter rules by rate_limit_id
      const rateLimitId = params?.[0];
      return rules.filter((r) => r.rate_limit_id === rateLimitId);
    },
    async get(_sql, params) {
      const rateLimitId = params?.[0];
      const matched = rules.filter((r) => r.rate_limit_id === rateLimitId);
      if (matched.length === 0) return null;
      return {
        mw: Math.max(...matched.map((r) => r.window_seconds)),
      };
    },
  };
}

describe("RateLimiter Service", () => {
  beforeEach(() => {
    rateLimiter.reset();
  });

  /**
   * Rationale: The most common case — requests within the allowed
   * window should be permitted without interference.
   */
  it("allows requests under the limit", async () => {
    const db = mockDb([
      { rate_limit_id: 10, window_seconds: 60, requests: 5 },
    ]);
    expect(await rateLimiter.check("preset:1", 10, db)).toBe(true);
    expect(await rateLimiter.check("preset:1", 10, db)).toBe(true);
  });

  /**
   * Rationale: Once the request count exceeds the configured limit
   * in a window, subsequent requests must be blocked. This is the
   * core protection against abuse.
   */
  it("blocks requests that exceed the limit", async () => {
    const db = mockDb([
      { rate_limit_id: 10, window_seconds: 60, requests: 3 },
    ]);
    expect(await rateLimiter.check("preset:1", 10, db)).toBe(true); // 1
    expect(await rateLimiter.check("preset:1", 10, db)).toBe(true); // 2
    expect(await rateLimiter.check("preset:1", 10, db)).toBe(true); // 3
    expect(await rateLimiter.check("preset:1", 10, db)).toBe(false); // blocked
  });

  /**
   * Rationale: Keys without a rate_limit_id should be unrestricted.
   * This supports keys that are meant for unlimited internal use.
   */
  it("allows requests when no rate_limit_id is set (null/undefined)", async () => {
    const db = mockDb([]);
    expect(await rateLimiter.check("preset:99", null, db)).toBe(true);
    expect(await rateLimiter.check("preset:99", undefined, db)).toBe(true);
  });

  /**
   * Rationale: When the rate_limit_id exists but has no rules defined,
   * all requests should be allowed (no rules = no restrictions).
   */
  it("allows requests when rate limit has no rules", async () => {
    const db = mockDb([]); // empty rules
    expect(await rateLimiter.check("preset:1", 10, db)).toBe(true);
    expect(await rateLimiter.check("preset:1", 10, db)).toBe(true);
  });

  /**
   * Rationale: Rate limits must be isolated per key. One key
   * hitting its limit must not affect another key.
   */
  it("isolates rate limits per key", async () => {
    const db = mockDb([
      { rate_limit_id: 10, window_seconds: 60, requests: 2 },
    ]);
    expect(await rateLimiter.check("preset:1", 10, db)).toBe(true);
    expect(await rateLimiter.check("preset:1", 10, db)).toBe(true);
    expect(await rateLimiter.check("preset:1", 10, db)).toBe(false); // key 1 blocked

    // Different key should still be allowed
    expect(await rateLimiter.check("preset:2", 10, db)).toBe(true);
  });

  /**
   * Rationale: Multiple rules can apply (e.g., 10/min AND 100/hour).
   * If any rule is exceeded, the request is blocked.
   */
  it("enforces multiple rules per rate limit", async () => {
    const db = mockDb([
      { rate_limit_id: 10, window_seconds: 60, requests: 5 },  // 5/min
      { rate_limit_id: 10, window_seconds: 10, requests: 2 },  // 2/10s
    ]);
    // Should be blocked after 2 in 10s, even though 5/min not reached
    expect(await rateLimiter.check("preset:1", 10, db)).toBe(true);
    expect(await rateLimiter.check("preset:1", 10, db)).toBe(true);
    expect(await rateLimiter.check("preset:1", 10, db)).toBe(false);
  });

  /**
   * Rationale: The reset() method is used between tests and when
   * the server needs to clear all rate-limit state. After reset,
   * previously blocked keys should be allowed again.
   */
  it("reset() clears all counter state", async () => {
    const db = mockDb([
      { rate_limit_id: 10, window_seconds: 60, requests: 1 },
    ]);
    expect(await rateLimiter.check("preset:1", 10, db)).toBe(true);
    expect(await rateLimiter.check("preset:1", 10, db)).toBe(false);

    rateLimiter.reset();
    expect(await rateLimiter.check("preset:1", 10, db)).toBe(true); // allowed again
  });

  /**
   * Rationale: Store keys should be pruned when all their timestamps
   * have expired. This prevents unbounded growth from deleted/unused presets.
   */
  it("prunes store keys when all timestamps expire", async () => {
    // Use a very short window (1 second) so timestamps expire quickly
    const db = mockDb([
      { rate_limit_id: 10, window_seconds: 1, requests: 100 },
    ]);

    // Add a request — should create a store key
    expect(await rateLimiter.check("preset:prune", 10, db)).toBe(true);
    expect(rateLimiter.store.has("preset:prune")).toBe(true);

    // Wait for the window to expire
    await new Promise((resolve) => setTimeout(resolve, 1100));

    // Next check should prune the expired timestamps then re-init
    expect(await rateLimiter.check("preset:prune", 10, db)).toBe(true);

    // The key should still exist (just re-initialized with the new request)
    expect(rateLimiter.store.has("preset:prune")).toBe(true);
    // But it should only have 1 entry (the new request), not the old one
    expect(rateLimiter.store.get("preset:prune")).toHaveLength(1);
  });
});
