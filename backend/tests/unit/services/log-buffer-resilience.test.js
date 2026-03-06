/**
 * Unit tests for LogBuffer flush resilience.
 *
 * Verifies that failed flushes re-queue batches, the memory cap
 * drops oldest entries, and exponential back-off prevents hammering
 * a down database.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { LogBuffer } from "../../../src/services/log-buffer.js";

/** Helper: create a minimal log entry. */
const entry = (i = 1) => ({
  apiKeyId: i,
  resourceId: 1,
  method: "GET",
  url: `http://example.com/${i}`,
});

describe("LogBuffer — flush resilience", () => {
  const instances = [];
  const create = (...args) => {
    const buf = new LogBuffer(...args);
    instances.push(buf);
    return buf;
  };

  afterEach(() => {
    instances.forEach((b) => b.reset());
    instances.length = 0;
  });

  // ── Re-queue on failure ─────────────────────────────────────────────

  it("re-queues failed batch back into the buffer", async () => {
    const buf = create(2000, 200, 10000);
    buf._insertBatch = vi.fn().mockRejectedValue(new Error("DB down"));

    buf.push(entry(1));
    buf.push(entry(2));
    expect(buf.buffer).toHaveLength(2);

    await buf.flush();

    // Entries should be back in the buffer after failure
    expect(buf.buffer).toHaveLength(2);
    expect(buf.buffer[0].apiKeyId).toBe(1);
    expect(buf.buffer[1].apiKeyId).toBe(2);
  });

  it("preserves order when re-queuing failed batch before new entries", async () => {
    const buf = create(2000, 200, 10000);
    let flushCount = 0;

    buf._insertBatch = vi.fn().mockImplementation(async () => {
      flushCount++;
      if (flushCount === 1) throw new Error("DB down");
      // Second call succeeds
    });

    buf.push(entry(1));
    buf.push(entry(2));
    await buf.flush(); // fails → re-queued

    // New entries pushed after failure
    buf.push(entry(3));

    // Buffer should be: [1, 2 (re-queued), 3 (new)]
    expect(buf.buffer).toHaveLength(3);
    expect(buf.buffer[0].apiKeyId).toBe(1);
    expect(buf.buffer[1].apiKeyId).toBe(2);
    expect(buf.buffer[2].apiKeyId).toBe(3);
  });

  it("tracks consecutive failure count", async () => {
    const buf = create(2000, 200, 10000);
    buf._insertBatch = vi.fn().mockRejectedValue(new Error("DB down"));

    buf.push(entry(1));
    await buf.flush();
    expect(buf._consecutiveFailures).toBe(1);

    // Need to reset backoff counter so second flush actually executes
    buf._backoffCounter = Infinity;
    await buf.flush();
    expect(buf._consecutiveFailures).toBe(2);
  });

  it("resets consecutive failure count on success", async () => {
    const buf = create(2000, 200, 10000);
    buf._insertBatch = vi.fn()
      .mockRejectedValueOnce(new Error("DB down"))
      .mockResolvedValueOnce(undefined);

    buf.push(entry(1));
    await buf.flush(); // fail
    expect(buf._consecutiveFailures).toBe(1);

    // Force past backoff
    buf._backoffCounter = Infinity;
    await buf.flush(); // succeed
    expect(buf._consecutiveFailures).toBe(0);
    expect(buf.buffer).toHaveLength(0);
  });

  // ── Memory cap ──────────────────────────────────────────────────────

  it("drops oldest entries when buffer exceeds maxBufferCap", async () => {
    const buf = create(2000, 200, 5); // cap at 5 entries
    buf._insertBatch = vi.fn().mockRejectedValue(new Error("DB down"));

    // Push 3 entries, flush fails → 3 re-queued
    for (let i = 1; i <= 3; i++) buf.push(entry(i));
    await buf.flush();
    expect(buf.buffer).toHaveLength(3);

    // Push 4 more → total would be 7, exceeds cap of 5
    for (let i = 4; i <= 7; i++) buf.push(entry(i));

    // Force past backoff
    buf._backoffCounter = Infinity;
    await buf.flush();

    // Should have dropped 2 oldest, keeping 5
    expect(buf.buffer).toHaveLength(5);
    // Oldest entries (1, 2) should be dropped; 3-7 remain
    expect(buf.buffer[0].apiKeyId).toBe(3);
    expect(buf.buffer[4].apiKeyId).toBe(7);
  });

  it("does not drop entries when under maxBufferCap", async () => {
    const buf = create(2000, 200, 100);
    buf._insertBatch = vi.fn().mockRejectedValue(new Error("DB down"));

    for (let i = 1; i <= 10; i++) buf.push(entry(i));
    await buf.flush();

    expect(buf.buffer).toHaveLength(10);
    expect(buf.buffer[0].apiKeyId).toBe(1);
  });

  // ── Back-off ────────────────────────────────────────────────────────

  it("skips flush cycles during back-off after failures", async () => {
    const buf = create(2000, 200, 10000);
    buf._insertBatch = vi.fn().mockRejectedValue(new Error("DB down"));

    buf.push(entry(1));
    await buf.flush(); // failure 1 — _consecutiveFailures = 1

    // With 1 consecutive failure, back-off = 2^1 = 2 cycles to skip
    // Next flush should be skipped (backoffCounter goes from 0 → 1, needs 2)
    await buf.flush(); // skipped — buffer unchanged
    expect(buf._insertBatch).toHaveBeenCalledTimes(1); // still only 1 actual call

    // Second attempt passes backoff threshold
    await buf.flush(); // actually executes → failure 2
    expect(buf._insertBatch).toHaveBeenCalledTimes(2);
    expect(buf._consecutiveFailures).toBe(2);
  });

  // ── Shutdown always attempts flush ──────────────────────────────────

  it("shutdown resets failure count and flushes", async () => {
    const buf = create(2000, 200, 10000);
    buf._insertBatch = vi.fn()
      .mockRejectedValueOnce(new Error("DB down"))
      .mockResolvedValueOnce(undefined);

    buf.push(entry(1));
    await buf.flush(); // fail
    expect(buf._consecutiveFailures).toBe(1);

    await buf.shutdown(); // resets _consecutiveFailures, then flushes
    expect(buf._consecutiveFailures).toBe(0);
    expect(buf.buffer).toHaveLength(0);
  });

  // ── Reset clears failure state ──────────────────────────────────────

  it("reset clears consecutive failure count", () => {
    const buf = create(2000, 200, 10000);
    buf._consecutiveFailures = 5;
    buf._backoffCounter = 10;
    buf.push(entry(1));

    buf.reset();

    expect(buf._consecutiveFailures).toBe(0);
    expect(buf.buffer).toHaveLength(0);
  });
});
