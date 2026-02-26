/**
 * Data factory functions for test setup.
 *
 * Each factory creates a specific entity in the test database and returns
 * the created row(s). This keeps individual test files concise and ensures
 * consistent seeding patterns.
 *
 * NOTE: All legacy `account_id` references have been removed — the column
 * no longer exists in the current schema.
 */
import request from "supertest";
import { DEFAULT_RESOURCE, ADMIN_TOKEN } from "./constants.js";

/**
 * Log in as admin via HTTP and return the JWT token.
 * Uses the ADMIN_TOKEN env var / constant.
 */
export async function loginAsAdmin(app) {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ token: ADMIN_TOKEN });

  if (res.status !== 200) {
    throw new Error(
      `Admin login failed: ${res.status} ${JSON.stringify(res.body)}`,
    );
  }

  return { token: res.body.token };
}

/**
 * Seed a resource for the workspace.
 * Returns the full resource row.
 */
export async function seedResource(db, overrides = {}) {
  const data = { ...DEFAULT_RESOURCE, ...overrides };

  const result = await db.run(
    `INSERT INTO resources (name, unique_path, secret_api_key, external_api_url)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [
      data.name,
      data.unique_path,
      data.secret_api_key,
      data.external_api_url,
    ],
  );

  return await db.get("SELECT * FROM resources WHERE id = $1", [
    result.insertedId,
  ]);
}

/**
 * Seed an endpoint group for a resource.
 * Returns { id, name, resource_id }.
 */
export async function seedEndpointGroup(
  db,
  resourceId,
  { name = "Default Group" } = {},
) {
  const result = await db.run(
    "INSERT INTO endpoint_groups (resource_id, name) VALUES ($1, $2) RETURNING id",
    [resourceId, name],
  );

  return {
    id: result.insertedId,
    name,
    resource_id: resourceId,
  };
}

/**
 * Seed a preset.
 * Returns the full preset row.
 */
export async function seedPreset(
  db,
  {
    name = "Test Preset",
    description = "A test preset",
    is_full_access = false,
    is_system = false,
  } = {},
) {
  const result = await db.run(
    `INSERT INTO presets (name, description, is_full_access, is_system)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [name, description, is_full_access, is_system],
  );

  return await db.get("SELECT * FROM presets WHERE id = $1", [
    result.insertedId,
  ]);
}

/**
 * Seed an API key for a preset.
 * Returns the full api_keys row.
 */
export async function seedApiKey(
  db,
  presetId,
  {
    name = "Test Key",
    key_value = `uc-test00-${Math.random().toString(36).slice(2, 10)}`,
  } = {},
) {
  const result = await db.run(
    `INSERT INTO api_keys (preset_id, name, api_key)
     VALUES ($1, $2, $3) RETURNING id`,
    [presetId, name, key_value],
  );

  // Also create quota row
  await db.run(
    `INSERT INTO api_key_quotas (api_key_id, usage_counts, expiry_dates)
     VALUES ($1, '{}', '{}')
     ON CONFLICT (api_key_id) DO NOTHING`,
    [result.insertedId],
  );

  return await db.get("SELECT * FROM api_keys WHERE id = $1", [
    result.insertedId,
  ]);
}

/**
 * Seed an IP blocklist.
 * Returns the full row.
 */
export async function seedBlocklist(
  db,
  {
    name = "Test Blocklist",
    ips = "192.168.1.100",
    response_code = 403,
    response_body = '{"error": "IP blocked"}',
    response_type = "json",
  } = {},
) {
  const result = await db.run(
    `INSERT INTO ip_blocklists (name, ips, response_code, response_body, response_type)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [name, ips, response_code, response_body, response_type],
  );

  return await db.get("SELECT * FROM ip_blocklists WHERE id = $1", [
    result.insertedId,
  ]);
}

/**
 * Seed an IP allowlist.
 * Returns the full row.
 */
export async function seedAllowlist(
  db,
  {
    name = "Test Allowlist",
    ips = "10.0.0.1",
    response_code = 403,
    response_body = '{"error": "IP not allowed"}',
    response_type = "json",
  } = {},
) {
  const result = await db.run(
    `INSERT INTO ip_allowlists (name, ips, response_code, response_body, response_type)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [name, ips, response_code, response_body, response_type],
  );

  return await db.get("SELECT * FROM ip_allowlists WHERE id = $1", [
    result.insertedId,
  ]);
}

/**
 * Seed a rate limit with optional rules.
 * Returns the full rate limit row (without rules).
 */
export async function seedRateLimit(
  db,
  {
    name = "Test Rate Limit",
    rules = [{ requests: 10, window_seconds: 60 }],
  } = {},
) {
  const result = await db.run(
    "INSERT INTO key_rate_limits (name) VALUES ($1) RETURNING id",
    [name],
  );

  for (const rule of rules) {
    await db.run(
      "INSERT INTO rate_limit_rules (rate_limit_id, requests, window_seconds) VALUES ($1, $2, $3)",
      [result.insertedId, rule.requests, rule.window_seconds],
    );
  }

  return await db.get("SELECT * FROM key_rate_limits WHERE id = $1", [
    result.insertedId,
  ]);
}

/**
 * Create an auth header object for supertest .set() calls.
 */
export function authHeader(token) {
  return { Authorization: `Bearer ${token}` };
}
