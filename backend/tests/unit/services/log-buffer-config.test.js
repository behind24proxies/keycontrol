/**
 * Unit tests for LogBuffer env-configurable settings.
 *
 * Verifies that flushIntervalMs and maxBatchSize can be customised
 * via constructor params (which in production are fed from env vars
 * LOG_FLUSH_INTERVAL_MS and LOG_MAX_BATCH_SIZE).
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

describe("LogBuffer — configurable settings", () => {
  /** Track all instances so we can clean them up. */
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

  // ── Constructor defaults ────────────────────────────────────────────

  it("uses default flushIntervalMs of 2 000 ms when not specified", () => {
    const buf = create();
    expect(buf.flushIntervalMs).toBe(2000);
  });

  it("uses default maxBatchSize of 200 when not specified", () => {
    const buf = create();
    expect(buf.maxBatchSize).toBe(200);
  });

  // ── Custom values via constructor ───────────────────────────────────

  it("accepts a custom flushIntervalMs", () => {
    const buf = create(5000);
    expect(buf.flushIntervalMs).toBe(5000);
  });

  it("accepts a custom maxBatchSize", () => {
    const buf = create(2000, 50);
    expect(buf.maxBatchSize).toBe(50);
  });

  it("accepts both custom values simultaneously", () => {
    const buf = create(10000, 500);
    expect(buf.flushIntervalMs).toBe(10000);
    expect(buf.maxBatchSize).toBe(500);
  });

  // ── Auto-flush triggers at custom maxBatchSize ──────────────────────

  it("triggers flush when buffer reaches a small custom maxBatchSize", () => {
    const buf = create(2000, 3); // flush at 3 entries
    const flushSpy = vi.spyOn(buf, "flush");

    buf.push(entry(1));
    buf.push(entry(2));
    expect(flushSpy).not.toHaveBeenCalled();

    buf.push(entry(3)); // hits maxBatchSize
    expect(flushSpy).toHaveBeenCalledTimes(1);
  });

  it("does NOT auto-flush before reaching maxBatchSize", () => {
    const buf = create(2000, 5);
    const flushSpy = vi.spyOn(buf, "flush");

    for (let i = 0; i < 4; i++) buf.push(entry(i));
    expect(flushSpy).not.toHaveBeenCalled();
    expect(buf.buffer).toHaveLength(4);
  });

  it("triggers flush exactly at maxBatchSize = 1 (flush on every push)", () => {
    const buf = create(2000, 1);
    const flushSpy = vi.spyOn(buf, "flush");

    buf.push(entry(1));
    expect(flushSpy).toHaveBeenCalledTimes(1);

    buf.push(entry(2));
    expect(flushSpy).toHaveBeenCalledTimes(2);
  });

  // ── Timer uses the configured interval ──────────────────────────────

  it("start() creates a timer with the configured interval", () => {
    vi.useFakeTimers();

    const buf = create(500, 200); // 500ms flush interval
    const flushSpy = vi.spyOn(buf, "flush").mockResolvedValue(undefined);

    buf.start();
    expect(flushSpy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(499);
    expect(flushSpy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1); // exactly 500ms
    expect(flushSpy).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(500); // another tick
    expect(flushSpy).toHaveBeenCalledTimes(2);

    buf.reset();
    vi.useRealTimers();
  });

  it("different instances can have different flush intervals", () => {
    vi.useFakeTimers();

    const fast = create(100, 200);
    const slow = create(1000, 200);
    const fastFlush = vi.spyOn(fast, "flush").mockResolvedValue(undefined);
    const slowFlush = vi.spyOn(slow, "flush").mockResolvedValue(undefined);

    fast.start();
    slow.start();

    vi.advanceTimersByTime(100);
    expect(fastFlush).toHaveBeenCalledTimes(1);
    expect(slowFlush).not.toHaveBeenCalled();

    vi.advanceTimersByTime(900); // total 1000ms
    expect(fastFlush).toHaveBeenCalledTimes(10);
    expect(slowFlush).toHaveBeenCalledTimes(1);

    fast.reset();
    slow.reset();
    vi.useRealTimers();
  });

  // ── Singleton uses config values ────────────────────────────────────

  it("exported singleton reads values from config", async () => {
    // Dynamically import to get the singleton & config
    const { logBuffer } = await import("../../../src/services/log-buffer.js");
    const { config } = await import("../../../src/config/index.js");

    expect(logBuffer.flushIntervalMs).toBe(config.logFlushIntervalMs);
    expect(logBuffer.maxBatchSize).toBe(config.logMaxBatchSize);
    expect(logBuffer.maxBufferCap).toBe(config.logMaxBufferCap);
  });

  // ── Edge cases ──────────────────────────────────────────────────────

  it("handles very large maxBatchSize without premature flush", () => {
    const buf = create(2000, 10000);
    const flushSpy = vi.spyOn(buf, "flush");

    for (let i = 0; i < 9999; i++) buf.push(entry(i));
    expect(flushSpy).not.toHaveBeenCalled();
    expect(buf.buffer).toHaveLength(9999);

    buf.push(entry(10000)); // hits 10000
    expect(flushSpy).toHaveBeenCalledTimes(1);
  });
});
