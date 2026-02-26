import { getDb } from "../db/index.js";
import { logger } from "../utils/logger.js";

/**
 * In-process async log buffer.
 *
 * Decouples request-log persistence from the gateway hot path.
 * Log entries are batched in memory and flushed to Postgres
 * periodically or when the buffer reaches a configurable size.
 *
 * Usage:
 *   logBuffer.push({ apiKeyId, resourceId, ... })  // fire-and-forget
 *   await logBuffer.shutdown()                     // graceful drain
 */
class LogBuffer {
  /**
   * @param {number} flushIntervalMs – Timer interval for periodic flush (default 2 000 ms).
   * @param {number} maxBatchSize    – Flush immediately when the buffer reaches this size.
   */
  constructor(flushIntervalMs = 2000, maxBatchSize = 200) {
    /** @type {object[]} */
    this.buffer = [];
    this.flushIntervalMs = flushIntervalMs;
    this.maxBatchSize = maxBatchSize;
    this._timer = null;
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
    await this.flush();
  }

  /** Clear all state (useful in tests). */
  reset() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
    this.buffer = [];
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
   */
  async flush() {
    if (this.buffer.length === 0) return;

    // Drain the buffer atomically so new pushes during the INSERT
    // go into a fresh array
    const batch = this.buffer;
    this.buffer = [];

    try {
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
    } catch (err) {
      // Never let a flush failure crash the server
      logger.error("Log buffer flush failed:", err.message);
    }
  }
}

export const logBuffer = new LogBuffer();
