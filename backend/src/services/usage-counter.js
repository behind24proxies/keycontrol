import { getDb } from "../db/index.js";
import { logger } from "../utils/logger.js";

/**
 * In-process batch usage counter for api_key_quotas.
 *
 * Tracks per-resource usage counts in memory and flushes
 * increments to the api_key_quotas JSONB column periodically.
 *
 * Usage:
 *   usageCounter.increment(apiKeyId, resourceId)   // fire-and-forget
 *   usageCounter.getPending(apiKeyId, resourceId)   // for gateway check
 *   await usageCounter.flush()                     // batch update
 */
class UsageCounter {
  constructor(flushIntervalMs = 5000) {
    /** @type {Map<string, number>}  "ak:5:proj:12" → pending increment */
    this.pending = new Map();
    this.flushIntervalMs = flushIntervalMs;
    this._timer = null;
  }

  // ── Lifecycle ───────────────────────────────────────────────────────

  start() {
    if (this._timer) return;
    this._timer = setInterval(() => this.flush(), this.flushIntervalMs);
    if (this._timer.unref) this._timer.unref();
  }

  async shutdown() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
    await this.flush();
  }

  reset() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
    this.pending.clear();
  }

  // ── Core API ────────────────────────────────────────────────────────

  /**
   * Increment usage for an API key + resource. O(1), fire-and-forget.
   * @param {number} apiKeyId
   * @param {number} resourceId
   */
  increment(apiKeyId, resourceId) {
    const key = `ak:${apiKeyId}:proj:${resourceId}`;
    this.pending.set(key, (this.pending.get(key) || 0) + 1);
  }

  /**
   * Get pending (unflushed) increment for a specific API key + resource.
   * Used by the gateway to add to the DB count for an accurate check.
   */
  getPending(apiKeyId, resourceId) {
    const key = `ak:${apiKeyId}:proj:${resourceId}`;
    return this.pending.get(key) || 0;
  }

  /**
   * Initialize a lease expiry date for a specific API key + resource.
   * Called on first access — writes directly (not batched) since timing matters.
   *
   * @param {number} apiKeyId
   * @param {number} resourceId
   * @param {number} leaseSeconds
   */
  async initLease(apiKeyId, resourceId, leaseSeconds) {
    const db = getDb();
    const expiryDate = new Date(
      Date.now() + leaseSeconds * 1000,
    ).toISOString();
    const projKey = `proj:${resourceId}`;

    try {
      // Upsert the row first
      await db.run(
        `INSERT INTO api_key_quotas (api_key_id, usage_counts, expiry_dates)
         VALUES ($1, '{}', '{}')
         ON CONFLICT (api_key_id) DO NOTHING`,
        [apiKeyId],
      );

      // Set the expiry date for this project
      await db.run(
        `UPDATE api_key_quotas
         SET expiry_dates = jsonb_set(
           COALESCE(expiry_dates, '{}'),
           ARRAY[$2],
           to_jsonb($3::text)
         ),
         updated_at = NOW()
         WHERE api_key_id = $1`,
        [apiKeyId, projKey, expiryDate],
      );

      return expiryDate;
    } catch (err) {
      logger.error(
        `Failed to init lease for ak:${apiKeyId}:proj:${resourceId}:`,
        err.message,
      );
      return null;
    }
  }

  /**
   * Flush all pending increments to the api_key_quotas table.
   * Groups by API key to minimise UPDATE count (one per key).
   */
  async flush() {
    if (this.pending.size === 0) return;

    const snapshot = new Map(this.pending);
    this.pending.clear();

    // Group by API key: "ak:5" → { "proj:12": 3, "proj:7": 1 }
    const entities = new Map();
    for (const [key, delta] of snapshot) {
      // key = "ak:5:proj:12"
      const parts = key.split(":");
      const apiKeyId = parts[1]; // "5"
      const projKey = `proj:${parts[3]}`; // "proj:12"
      if (!entities.has(apiKeyId)) entities.set(apiKeyId, {});
      entities.get(apiKeyId)[projKey] = delta;
    }

    const db = getDb();

    for (const [apiKeyIdStr, increments] of entities) {
      const apiKeyId = parseInt(apiKeyIdStr, 10);

      try {
        // Upsert: create row if not exists, then apply JSONB increments
        await db.run(
          `INSERT INTO api_key_quotas (api_key_id, usage_counts, expiry_dates)
           VALUES ($1, '{}', '{}')
           ON CONFLICT (api_key_id) DO NOTHING`,
          [apiKeyId],
        );

        // Build a chain of jsonb_set calls to increment each project
        let expr = "usage_counts";
        const params = [apiKeyId];
        let paramIdx = 2;

        for (const [projKey, delta] of Object.entries(increments)) {
          expr = `jsonb_set(
            COALESCE(${expr}, '{}'),
            ARRAY[$${paramIdx}],
            to_jsonb(COALESCE((usage_counts->>${'$' + paramIdx})::int, 0) + $${paramIdx + 1})
          )`;
          params.push(projKey, delta);
          paramIdx += 2;
        }

        await db.run(
          `UPDATE api_key_quotas SET usage_counts = ${expr}, updated_at = NOW() WHERE api_key_id = $1`,
          params,
        );
      } catch (err) {
        logger.error(
          `Usage counter flush failed for ak:${apiKeyIdStr}:`,
          err.message,
        );
      }
    }
  }
}

export const usageCounter = new UsageCounter();
