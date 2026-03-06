/**
 * Sliding-window rate limiter with persistence.
 *
 * Uses an in-memory Map for fast lookups. On startup, call warm(db) to
 * repopulate from request_logs so rate limits survive server restarts.
 *
 * Keyed by preset ID (e.g. "preset:5").
 */
class RateLimiter {
  constructor() {
    /** @type {Map<string, number[]>}  rateLimitKey → sorted timestamp array */
    this.store = new Map();
  }

  /**
   * Warm the rate limiter from presets.
   * For each preset with a rate_limit_id, load recent request counts
   * from users assigned to that preset.
   */
  async warm(db) {
    const presets = await db.all(
      `SELECT id, rate_limit_id FROM presets WHERE rate_limit_id IS NOT NULL`,
    );

    for (const preset of presets) {
      const maxWindow = await db.get(
        "SELECT MAX(window_seconds) as mw FROM rate_limit_rules WHERE rate_limit_id = $1",
        [preset.rate_limit_id],
      );

      if (maxWindow?.mw) {
        const cutoff = new Date(Date.now() - maxWindow.mw * 1000).toISOString();
        // Count recent logs for all API keys that use this preset
        const logs = await db.all(
          `SELECT rl.created_at FROM request_logs rl
           WHERE rl.created_at > $2
             AND rl.api_key_id IN (SELECT id FROM api_keys WHERE preset_id = $1)
           ORDER BY rl.created_at ASC`,
          [preset.id, cutoff],
        );

        if (logs.length > 0) {
          this.store.set(
            `preset:${preset.id}`,
            logs.map((l) => new Date(l.created_at).getTime()),
          );
        }
      }
    }
  }

  /**
   * Check whether the request is within rate limits.
   * Returns true if allowed, false if rate-limited.
   * Automatically records the request timestamp on success.
   */
  async check(rateLimitKey, rateLimitId, db) {
    if (!rateLimitId) return true;

    const rules = await db.all(
      "SELECT * FROM rate_limit_rules WHERE rate_limit_id = $1 ORDER BY window_seconds ASC",
      [rateLimitId],
    );

    if (rules.length === 0) return true;

    const now = Date.now();

    if (!this.store.has(rateLimitKey)) {
      this.store.set(rateLimitKey, []);
    }

    const requests = this.store.get(rateLimitKey);

    // Clean old entries beyond the largest window
    const maxWindow = Math.max(...rules.map((r) => r.window_seconds));
    const cutoff = now - maxWindow * 1000;
    const filtered = requests.filter((t) => t > cutoff);
    this.store.set(rateLimitKey, filtered);

    // Check every rule
    for (const rule of rules) {
      const windowStart = now - rule.window_seconds * 1000;
      const count = filtered.filter((t) => t > windowStart).length;
      if (count >= rule.requests) {
        // Prune empty keys to prevent unbounded store growth
        if (filtered.length === 0) {
          this.store.delete(rateLimitKey);
        }
        return false;
      }
    }

    // Record this request
    filtered.push(now);
    return true;
  }

  /** Clear all stored data (useful for tests). */
  reset() {
    this.store.clear();
  }
}

export const rateLimiter = new RateLimiter();
