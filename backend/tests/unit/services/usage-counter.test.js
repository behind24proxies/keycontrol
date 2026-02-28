/**
 * Unit tests for the UsageCounter service.
 *
 * The UsageCounter batches per-resource usage increments in memory and
 * flushes them to the api_key_quotas JSONB column periodically. These
 * tests verify the in-memory tracking logic without touching the database.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { usageCounter } from "../../../src/services/usage-counter.js";

describe("UsageCounter Service", () => {
  beforeEach(() => {
    usageCounter.reset();
  });

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

  /**
   * Rationale: reset() should clear all pending counts and timers.
   */
  it("reset clears all pending increments", () => {
    usageCounter.increment(1, 10);
    usageCounter.increment(2, 20);
    usageCounter.reset();

    expect(usageCounter.getPending(1, 10)).toBe(0);
    expect(usageCounter.getPending(2, 20)).toBe(0);
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
