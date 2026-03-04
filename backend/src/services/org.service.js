import { getDb } from "../db/index.js";

/**
 * Centralized organization service for the single-org model.
 *
 * Instead of scattering `WHERE id = 1` across every controller,
 * all org lookups go through these helpers.
 */

const ORG_ID = 1;

/**
 * Return the full organization row.
 * @param {import("../db/index.js").DbWrapper} [db] - optional db instance
 */
export async function getOrg(db) {
  db = db || getDb();
  return db.get("SELECT * FROM organization WHERE id = $1", [ORG_ID]);
}

/**
 * Return just the organization_code (used for API key prefixes).
 * @param {import("../db/index.js").DbWrapper} [db] - optional db instance
 * @returns {Promise<string>}
 */
export async function getOrgCode(db) {
  db = db || getDb();
  const org = await db.get(
    "SELECT organization_code FROM organization WHERE id = $1",
    [ORG_ID],
  );
  return org?.organization_code || "kc";
}

/**
 * Update a single organization setting.
 * @param {string} column - column name
 * @param {any} value - new value
 * @param {import("../db/index.js").DbWrapper} [db] - optional db instance
 */
export async function updateOrgSetting(column, value, db) {
  db = db || getDb();
  // Whitelist allowed columns to prevent SQL injection
  const allowed = [
    "log_ip_addresses",
    "organization_code",
    "two_factor_enabled",
    "two_factor_secret",
    "session_timeout_seconds",
    "master_api_key_hash",
    "master_api_key_prefix",
    "name",
    "debug_mode",
    "admin_password_hash",
    "last_reset_hash_used",
    "password_changed_at",
  ];
  if (!allowed.includes(column)) {
    throw new Error(`Cannot update disallowed org column: ${column}`);
  }
  await db.run(
    `UPDATE organization SET ${column} = $1 WHERE id = $2`,
    [value, ORG_ID],
  );
}
