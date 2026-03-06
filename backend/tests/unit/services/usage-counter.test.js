/**
 * Unit tests for the UsageCounter service.
 *
 * The UsageCounter batches per-resource usage increments in memory and
 * flushes them to the api_key_quotas JSONB column periodically. These
 * tests verify the in-memory tracking logic without touching the database.
 *
 * Covers both per-resource counters (increment/getPending) and per-key
 * global counters (incrementGlobal/getPendingGlobal).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { usageCounter } from "../../../src/services/usage-counter.js";

describe("UsageCounter Service", () => {
  beforeEach(() => {
    usageCounter.reset();
  });

  // ═══════════════════════════════════════════════════════════════════
  // Per-resource counters
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Rationale: increment() should accumulate counts in memory
   * keyed by (apiKeyId, resourceId).
   */
  it("tracks pending increments per api key and resource", () => {
    usageCounter.increment(1, 10);
    usageCounter.increment(1, 10);
    usageCounter.increment(1, 20);

    expect(usageCounter.getPending(1, 10)).toBe(2);
    expect(usageCounter.getPending(1, 20)).toBe(1);
  });

  /**
   * Rationale: getPending() for a key/resource that hasn't been
   * incremented should return 0, not undefined or null.
   */
  it("returns 0 for unknown key/resource combinations", () => {
    expect(usageCounter.getPending(999, 999)).toBe(0);
  });

  /**
   * Rationale: Different API keys using the same resource should
   * be tracked independently.
   */
  it("isolates counts between different API keys", () => {
    usageCounter.increment(1, 10);
    usageCounter.increment(2, 10);
    usageCounter.increment(2, 10);

    expect(usageCounter.getPending(1, 10)).toBe(1);
    expect(usageCounter.getPending(2, 10)).toBe(2);
  });

  // ═══════════════════════════════════════════════════════════════════
  // Per-key global counters
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Rationale: incrementGlobal() should accumulate a single global
   * counter per API key, independent of any resource.
   */
  it("tracks pending global increments per api key", () => {
    usageCounter.incrementGlobal(1);
    usageCounter.incrementGlobal(1);
    usageCounter.incrementGlobal(1);

    expect(usageCounter.getPendingGlobal(1)).toBe(3);
  });

  /**
   * Rationale: getPendingGlobal() for a key that hasn't been
   * incremented should return 0, not undefined or null.
   */
  it("returns 0 for unknown global key", () => {
    expect(usageCounter.getPendingGlobal(999)).toBe(0);
  });

  /**
   * Rationale: Different API keys should have independent global counters.
   */
  it("isolates global counts between different API keys", () => {
    usageCounter.incrementGlobal(1);
    usageCounter.incrementGlobal(2);
    usageCounter.incrementGlobal(2);

    expect(usageCounter.getPendingGlobal(1)).toBe(1);
    expect(usageCounter.getPendingGlobal(2)).toBe(2);
  });

  /**
   * Rationale: Per-resource and per-key global counters must be
   * fully independent — incrementing one must not affect the other.
   */
  it("per-resource and global counters are independent", () => {
    usageCounter.increment(1, 10);
    usageCounter.increment(1, 10);
    usageCounter.incrementGlobal(1);
    usageCounter.incrementGlobal(1);
    usageCounter.incrementGlobal(1);

    expect(usageCounter.getPending(1, 10)).toBe(2);
    expect(usageCounter.getPendingGlobal(1)).toBe(3);
  });

  // ═══════════════════════════════════════════════════════════════════
  // Shared lifecycle
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Rationale: reset() should clear all pending counts and timers,
   * including global counters.
   */
  it("reset clears all pending increments including global", () => {
    usageCounter.increment(1, 10);
    usageCounter.increment(2, 20);
    usageCounter.incrementGlobal(1);
    usageCounter.incrementGlobal(2);
    usageCounter.reset();

    expect(usageCounter.getPending(1, 10)).toBe(0);
    expect(usageCounter.getPending(2, 20)).toBe(0);
    expect(usageCounter.getPendingGlobal(1)).toBe(0);
    expect(usageCounter.getPendingGlobal(2)).toBe(0);
  });

  /**
   * Rationale: start() should be idempotent — calling it twice
   * must not create duplicate flush timers.
   */
  it("start is idempotent", () => {
    usageCounter.start();
    const timer1 = usageCounter._timer;
    usageCounter.start();
    const timer2 = usageCounter._timer;

    expect(timer1).toBe(timer2);
    usageCounter.reset(); // cleanup
  });

  /**
   * Rationale: flush() on empty pending map should be a no-op
   * and not attempt database access.
   */
  it("flush is a no-op when nothing is pending", async () => {
    // Should not throw even without a DB connection
    await usageCounter.flush();
    expect(usageCounter.pending.size).toBe(0);
  });
});
