import { getDb } from "../db/index.js";
import { logger } from "../utils/logger.js";

/**
 * Propagate quota changes (expiry dates) to all API keys
 * assigned to a given preset. Called when:
 *   - A preset's resources or their settings change
 *   - A preset is assigned to an API key
 *
 * Uses batch operations to minimise DB round-trips.
 */

/**
 * Build the expiry map for a preset's resources (per-resource quotas).
 * Returns { [resourceId]: expiryDateISO | null }
 */
function buildExpiryMap(resources) {
  const map = {};
  for (const r of resources) {
    if (r.lease_seconds) {
      map[`proj:${r.resource_id || r.id}`] = new Date(
        Date.now() + r.lease_seconds * 1000,
      ).toISOString();
    }
  }
  return map;
}

/**
 * Propagate quota settings for all API keys on a given preset.
 * Merges new resource expiries into existing api_key_quotas rows,
 * preserving any existing lease that hasn't expired yet.
 *
 * @param {number} presetId
 * @param {Array<{resource_id: number, lease_seconds: number|null, usage_limit: number|null}>} resources
 */
export async function propagateQuotasForPreset(presetId, resources) {
  const db = getDb();

  const expiryMap = buildExpiryMap(resources);
  if (Object.keys(expiryMap).length === 0) return;

  // Gather all API keys on this preset
  const apiKeys = await db.all(
    "SELECT id FROM api_keys WHERE preset_id = $1",
    [presetId],
  );

  if (apiKeys.length === 0) return;

  for (const ak of apiKeys) {
    try {
      // Upsert the quota row
      await db.run(
        `INSERT INTO api_key_quotas (api_key_id, usage_counts, expiry_dates)
         VALUES ($1, '{}', '{}')
         ON CONFLICT (api_key_id) DO NOTHING`,
        [ak.id],
      );

      // Fetch existing expiries to preserve unexpired leases
      const existing = await db.get(
        `SELECT expiry_dates FROM api_key_quotas WHERE api_key_id = $1`,
        [ak.id],
      );
      const existingExpiries = existing?.expiry_dates || {};

      // Merge: only set expiry if one doesn't already exist or has expired
      for (const [projKey, newExpiry] of Object.entries(expiryMap)) {
        const current = existingExpiries[projKey];
        if (current && new Date(current).getTime() > Date.now()) {
          // Existing lease still valid — don't overwrite
          continue;
        }
        // Set/reset the expiry
        await db.run(
          `UPDATE api_key_quotas
           SET expiry_dates = jsonb_set(
             COALESCE(expiry_dates, '{}'),
             ARRAY[$2],
             to_jsonb($3::text)
           ),
           updated_at = NOW()
           WHERE api_key_id = $1`,
          [ak.id, projKey, newExpiry],
        );
      }
    } catch (err) {
      logger.error(
        `Failed to propagate quotas for api_key_id=${ak.id}:`,
        err.message,
      );
    }
  }
}

/**
 * Initialize quotas for a single API key being assigned to a preset.
 *
 * @param {number} apiKeyId
 * @param {number} presetId
 */
export async function initQuotasForApiKey(apiKeyId, presetId) {
  const db = getDb();

  const resources = await db.all(
    `SELECT resource_id, lease_seconds, usage_limit
     FROM preset_resources
     WHERE preset_id = $1`,
    [presetId],
  );

  const expiryMap = buildExpiryMap(resources);
  if (Object.keys(expiryMap).length === 0) return;

  try {
    // Upsert quota row
    await db.run(
      `INSERT INTO api_key_quotas (api_key_id, usage_counts, expiry_dates)
       VALUES ($1, '{}', '{}')
       ON CONFLICT (api_key_id) DO NOTHING`,
      [apiKeyId],
    );

    // Set expiry for each resource with a lease
    for (const [projKey, expiry] of Object.entries(expiryMap)) {
      await db.run(
        `UPDATE api_key_quotas
         SET expiry_dates = jsonb_set(
           COALESCE(expiry_dates, '{}'),
           ARRAY[$2],
           to_jsonb($3::text)
         ),
         updated_at = NOW()
         WHERE api_key_id = $1`,
        [apiKeyId, projKey, expiry],
      );
    }
  } catch (err) {
    logger.error(
      `Failed to init quotas for api_key ${apiKeyId}:`,
      err.message,
    );
  }
}
