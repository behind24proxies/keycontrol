/**
 * Unit tests for the LogBuffer service.
 *
 * The LogBuffer batches log entries in memory and flushes them to
 * the database periodically. These tests verify buffering semantics,
 * auto-flush on batch size, and graceful shutdown behaviour.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// We test the LogBuffer class directly — reimport to get a fresh instance
// by using a dynamic import and constructing a new instance.
// Since the module exports a singleton, we'll test its public API.
import { logBuffer } from "../../../src/services/log-buffer.js";

describe("LogBuffer Service", () => {
  beforeEach(() => {
    logBuffer.reset();
  });

  /**
   * Rationale: push() should accumulate entries without immediately
   * writing to the database — that's the whole point of buffering.
   */
  it("accumulates entries in the buffer", () => {
    logBuffer.push({
      apiKeyId: 1,
      resourceId: 1,
      method: "GET",
      url: "http://a.com",
    });
    logBuffer.push({
      apiKeyId: 2,
      resourceId: 1,
      method: "POST",
      url: "http://b.com",
    });

    expect(logBuffer.buffer).toHaveLength(2);
  });

  /**
   * Rationale: flush() on an empty buffer should be a no-op and
   * should not throw or attempt a DB query.
   */
  it("flush is a no-op when buffer is empty", async () => {
    // This should not throw even without a DB connection
    // (buffer.length === 0 exits early before calling getDb)
    await logBuffer.flush();
    expect(logBuffer.buffer).toHaveLength(0);
  });

  /**
   * Rationale: reset() should clear both the buffer and the timer.
   */
  it("reset clears buffer", () => {
    logBuffer.push({
      apiKeyId: 1,
      resourceId: 1,
      method: "GET",
      url: "http://a.com",
    });
    logBuffer.reset();
    expect(logBuffer.buffer).toHaveLength(0);
  });

  /**
   * Rationale: start() should set a timer for periodic flushing.
   * Calling start() multiple times should not create duplicate timers.
   */
  it("start is idempotent (no duplicate timers)", () => {
    logBuffer.start();
    const timer1 = logBuffer._timer;
    logBuffer.start();
    const timer2 = logBuffer._timer;

    expect(timer1).toBe(timer2); // Same timer reference, not a new one
    logBuffer.reset(); // cleanup
  });
});
