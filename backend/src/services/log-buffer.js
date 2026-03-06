import { getDb } from "../db/index.js";
import { logger } from "../utils/logger.js";
import { config } from "../config/index.js";

/**
 * In-process async log buffer.
 *
 * Decouples request-log persistence from the gateway hot path.
 * Log entries are batched in memory and flushed to Postgres
 * periodically or when the buffer reaches a configurable size.
 *
 * Resilience: failed flushes re-queue the batch so entries are
 * retried on the next cycle. A configurable cap prevents unbounded
 * memory growth during extended DB outages.
 *
 * Usage:
 *   logBuffer.push({ apiKeyId, resourceId, ... })  // fire-and-forget
 *   await logBuffer.shutdown()                     // graceful drain
 */
class LogBuffer {
  /**
   * @param {number} flushIntervalMs – Timer interval for periodic flush (default 2 000 ms).
   * @param {number} maxBatchSize    – Flush immediately when the buffer reaches this size.
   * @param {number} maxBufferCap    – Max entries held in memory; oldest dropped when exceeded.
   */
  constructor(flushIntervalMs = 2000, maxBatchSize = 200, maxBufferCap = 10000) {
    /** @type {object[]} */
    this.buffer = [];
    this.flushIntervalMs = flushIntervalMs;
    this.maxBatchSize = maxBatchSize;
    this.maxBufferCap = maxBufferCap;
    this._timer = null;
    this._consecutiveFailures = 0;
  }

  // ── Lifecycle ───────────────────────────────────────────────────────

  /** Start the periodic flush timer. */
  start() {
    if (this._timer) return;
    this._timer = setInterval(() => this.flush(), this.flushIntervalMs);
    // Allow the process to exit even if the timer hasn't fired
    if (this._timer.unref) this._timer.unref();
  }

  /**
   * Graceful shutdown — flush remaining entries and stop the timer.
   * Call this BEFORE closing the database pool.
   */
  async shutdown() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
    this._consecutiveFailures = 0; // always attempt final flush
    await this.flush();
  }

  /** Clear all state (useful in tests). */
  reset() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
    this.buffer = [];
    this._consecutiveFailures = 0;
  }

  // ── Core API ────────────────────────────────────────────────────────

  /**
   * Enqueue a log entry. Returns immediately — never throws.
   *
   * @param {object} entry
   * @param {number|null} entry.apiKeyId
   * @param {number}      entry.resourceId
   * @param {string}      entry.method
   * @param {string}      entry.url
   * @param {string}      [entry.headers]
   * @param {string}      [entry.body]
   * @param {number}      [entry.responseCode]
   * @param {string}      [entry.responseBody]
   * @param {number}      [entry.durationMs]
   * @param {number}      [entry.upstreamStatusCode]
   * @param {string|null} [entry.ip]
   */
  push(entry) {
    this.buffer.push(entry);
    if (this.buffer.length >= this.maxBatchSize) {
      // Fire-and-forget — don't await; just kick off the flush
      this.flush();
    }
  }

  /**
   * Flush the current buffer to Postgres in a single multi-row INSERT.
   * Safe to call at any time — no-ops when the buffer is empty.
   *
   * On failure the batch is re-queued for the next flush cycle.
   * An exponential back-off skips flushes after repeated failures
   * to avoid hammering a down database.
   */
  async flush() {
    if (this.buffer.length === 0) return;

    // Back-off: skip this flush if DB has been failing repeatedly.
    // Allow retry every 2^n cycles (1, 2, 4, 8 …), capped at 32.
    if (this._consecutiveFailures > 0) {
      const skipCycles = Math.min(2 ** this._consecutiveFailures, 32);
      this._backoffCounter = (this._backoffCounter || 0) + 1;
      if (this._backoffCounter < skipCycles) return;
      this._backoffCounter = 0;
    }

    // Drain the buffer atomically so new pushes during the INSERT
    // go into a fresh array
    const batch = this.buffer;
    this.buffer = [];

    try {
      await this._insertBatch(batch);
      this._consecutiveFailures = 0;
    } catch (err) {
      this._consecutiveFailures++;
      logger.error(
        `Log buffer flush failed (attempt ${this._consecutiveFailures}):`,
        err.message,
      );

      // Re-queue failed batch (prepend to preserve chronological order)
      this.buffer = [...batch, ...this.buffer];

      // Enforce memory cap — drop oldest entries if over limit
      if (this.buffer.length > this.maxBufferCap) {
        const dropped = this.buffer.length - this.maxBufferCap;
        this.buffer = this.buffer.slice(dropped);
        logger.warn(
          `Log buffer cap reached — dropped ${dropped} oldest entries`,
        );
      }
    }
  }

  /**
   * Execute the multi-row INSERT for a batch of entries.
   * Extracted as a separate method for testability.
   *
   * @param {object[]} batch
   */
  async _insertBatch(batch) {
    const db = getDb();
    const columns = [
      "api_key_id",
      "resource_id",
      "method",
      "url",
      "headers",
      "body",
      "response_code",
      "response_body",
      "duration_ms",
      "upstream_status_code",
      "ip_address",
    ];
    const colCount = columns.length;

    const valueClauses = [];
    const params = [];

    for (let i = 0; i < batch.length; i++) {
      const base = i * colCount;
      const placeholders = columns.map((_, j) => `$${base + j + 1}`);
      valueClauses.push(`(${placeholders.join(",")})`);

      const e = batch[i];
      params.push(
        e.apiKeyId ?? null,
        e.resourceId,
        e.method,
        e.url,
        e.headers ?? null,
        e.body ?? null,
        e.responseCode ?? null,
        e.responseBody ?? null,
        e.durationMs ?? null,
        e.upstreamStatusCode ?? null,
        e.ip ?? null,
      );
    }

    const sql = `INSERT INTO request_logs (${columns.join(",")}) VALUES ${valueClauses.join(",")}`;
    await db.run(sql, params);
  }
}

export { LogBuffer };

export const logBuffer = new LogBuffer(
  config.logFlushIntervalMs,
  config.logMaxBatchSize,
  config.logMaxBufferCap,
);
