import crypto from "crypto";
import bcrypt from "bcryptjs";
import { config } from "../config/index.js";

/**
 * Initialize Postgres schema — creates tables, indexes, and seeds.
 * Safe to call on every startup (uses IF NOT EXISTS / ON CONFLICT).
 *
 * NOTE: All one-time migrations have been removed. This file should only
 * contain idempotent DDL (CREATE TABLE/INDEX IF NOT EXISTS) and upsert seeds.
 */
export async function initSchema(db) {
  // ── IP Blocklists (global) ──────────────────────────────────────────
  await db.exec(`
    CREATE TABLE IF NOT EXISTS ip_blocklists (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      ips TEXT NOT NULL,
      response_code INTEGER DEFAULT 403,
      response_body TEXT DEFAULT '{"error": "IP blocked"}',
      response_type TEXT DEFAULT 'json',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // ── IP Allowlists (global) ──────────────────────────────────────────
  await db.exec(`
    CREATE TABLE IF NOT EXISTS ip_allowlists (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      ips TEXT NOT NULL,
      response_code INTEGER DEFAULT 403,
      response_body TEXT DEFAULT '{"error": "IP not allowed"}',
      response_type TEXT DEFAULT 'json',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // ── Key Rate Limits (global) ────────────────────────────────────────
  await db.exec(`
    CREATE TABLE IF NOT EXISTS key_rate_limits (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      response_code INTEGER DEFAULT 429,
      response_body TEXT DEFAULT '{"error": "Rate limit exceeded"}',
      response_type TEXT DEFAULT 'json',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // ── Rate Limit Rules ────────────────────────────────────────────────
  await db.exec(`
    CREATE TABLE IF NOT EXISTS rate_limit_rules (
      id SERIAL PRIMARY KEY,
      rate_limit_id INTEGER NOT NULL REFERENCES key_rate_limits(id) ON DELETE CASCADE,
      requests INTEGER NOT NULL,
      window_seconds INTEGER NOT NULL
    )
  `);

  // ── Organization (workspace metadata) ───────────────────────────────
  await db.exec(`
    CREATE TABLE IF NOT EXISTS organization (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      log_ip_addresses INTEGER DEFAULT 0,
      organization_code TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Admin security columns (2FA + session timeout)
  await db.exec(`ALTER TABLE organization ADD COLUMN IF NOT EXISTS two_factor_enabled INTEGER DEFAULT 0`);
  await db.exec(`ALTER TABLE organization ADD COLUMN IF NOT EXISTS two_factor_secret TEXT`);
  await db.exec(`ALTER TABLE organization ADD COLUMN IF NOT EXISTS session_timeout_seconds INTEGER DEFAULT 3600`);

  // Master API key columns
  await db.exec(`ALTER TABLE organization ADD COLUMN IF NOT EXISTS master_api_key_hash TEXT`);
  await db.exec(`ALTER TABLE organization ADD COLUMN IF NOT EXISTS master_api_key_prefix TEXT`);

  // Gateway debug mode
  await db.exec(`ALTER TABLE organization ADD COLUMN IF NOT EXISTS debug_mode INTEGER DEFAULT 0`);

  // Admin password columns (DB-backed auth)
  await db.exec(`ALTER TABLE organization ADD COLUMN IF NOT EXISTS admin_password_hash TEXT`);
  await db.exec(`ALTER TABLE organization ADD COLUMN IF NOT EXISTS last_reset_hash_used TEXT`);
  await db.exec(`ALTER TABLE organization ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ`);

  // ── Resources (upstream APIs being proxied) ─────────────────────────
  await db.exec(`
    CREATE TABLE IF NOT EXISTS resources (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      unique_path TEXT NOT NULL UNIQUE,
      secret_api_key TEXT NOT NULL,
      external_api_url TEXT NOT NULL,
      description TEXT,
      timeout_seconds INTEGER,
      timeout_response_code INTEGER DEFAULT 504,
      timeout_response_body TEXT DEFAULT '{"error": "Request timeout"}',
      timeout_response_type TEXT DEFAULT 'json',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Migration: drop legacy account_id column if present
  await db.exec(`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'resources' AND column_name = 'account_id'
      ) THEN
        ALTER TABLE resources DROP COLUMN account_id;
      END IF;
    END $$
  `);

  // ── Endpoint Groups ─────────────────────────────────────────────────
  await db.exec(`
    CREATE TABLE IF NOT EXISTS endpoint_groups (
      id SERIAL PRIMARY KEY,
      resource_id INTEGER NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT
    )
  `);

  // ── Endpoints ───────────────────────────────────────────────────────
  await db.exec(`
    CREATE TABLE IF NOT EXISTS endpoints (
      id SERIAL PRIMARY KEY,
      endpoint_group_id INTEGER NOT NULL REFERENCES endpoint_groups(id) ON DELETE CASCADE,
      url_pattern TEXT NOT NULL,
      method TEXT NOT NULL
    )
  `);

  // ── Presets ──────────────────────────────────────────────────────────
  await db.exec(`
    CREATE TABLE IF NOT EXISTS presets (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      is_full_access BOOLEAN DEFAULT FALSE,
      is_system BOOLEAN DEFAULT FALSE,
      rate_limit_id INTEGER REFERENCES key_rate_limits(id) ON DELETE SET NULL,
      ip_allowlist_id INTEGER REFERENCES ip_allowlists(id) ON DELETE SET NULL,
      ip_blocklist_id INTEGER REFERENCES ip_blocklists(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Migration: drop legacy account_id column if present
  await db.exec(`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'presets' AND column_name = 'account_id'
      ) THEN
        -- Drop old compound index first
        DROP INDEX IF EXISTS idx_presets_account_name;
        ALTER TABLE presets DROP COLUMN account_id;
      END IF;
    END $$
  `);

  // Additive migration: add is_full_access if not present (existing DBs)
  await db.exec(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'presets' AND column_name = 'is_full_access'
      ) THEN
        ALTER TABLE presets ADD COLUMN is_full_access BOOLEAN DEFAULT FALSE;
      END IF;
    END $$
  `);

  // Additive migration: add allowed_methods to presets
  await db.exec(`ALTER TABLE presets ADD COLUMN IF NOT EXISTS allowed_methods TEXT DEFAULT 'GET,POST,PUT,PATCH,DELETE,HEAD'`);

  // Additive migration: add is_system if not present (existing DBs)
  await db.exec(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'presets' AND column_name = 'is_system'
      ) THEN
        ALTER TABLE presets ADD COLUMN is_system BOOLEAN DEFAULT FALSE;
      END IF;
    END $$
  `);

  // ── Preset ↔ Endpoint Group Mappings ────────────────────────────────
  await db.exec(`
    CREATE TABLE IF NOT EXISTS preset_endpoint_groups (
      id SERIAL PRIMARY KEY,
      preset_id INTEGER NOT NULL REFERENCES presets(id) ON DELETE CASCADE,
      endpoint_group_id INTEGER NOT NULL REFERENCES endpoint_groups(id) ON DELETE CASCADE,
      lease_seconds INTEGER,
      usage_limit INTEGER,
      UNIQUE(preset_id, endpoint_group_id)
    )
  `);

  // ── Preset ↔ Resource Mappings ──────────────────────────────────────
  await db.exec(`
    CREATE TABLE IF NOT EXISTS preset_resources (
      id SERIAL PRIMARY KEY,
      preset_id INTEGER NOT NULL REFERENCES presets(id) ON DELETE CASCADE,
      resource_id INTEGER NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
      usage_limit INTEGER,
      lease_seconds INTEGER,
      UNIQUE(preset_id, resource_id)
    )
  `);

  // Additive migration: add quota columns to preset_resources for per-resource quotas
  await db.exec(`ALTER TABLE preset_resources ADD COLUMN IF NOT EXISTS usage_limit INTEGER`);
  await db.exec(`ALTER TABLE preset_resources ADD COLUMN IF NOT EXISTS lease_seconds INTEGER`);

  // ── Legacy tables (kept for migration safety, no longer used by code)
  // users, master_keys, categories, user_categories — left in place

  // ── API Keys (renamed from use_cases) ───────────────────────────────
  // Migration: rename use_cases → api_keys if old name still exists
  await db.exec(`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'use_cases' AND table_schema = 'public'
      ) THEN
        ALTER TABLE use_cases RENAME TO api_keys;
      END IF;
    END $$
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id SERIAL PRIMARY KEY,
      preset_id INTEGER NOT NULL REFERENCES presets(id) ON DELETE RESTRICT,
      name TEXT NOT NULL,
      description TEXT,
      api_key TEXT NOT NULL UNIQUE,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Migration: drop legacy account_id column if present
  await db.exec(`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'api_keys' AND column_name = 'account_id'
      ) THEN
        DROP INDEX IF EXISTS idx_api_keys_account;
        ALTER TABLE api_keys DROP COLUMN account_id;
      END IF;
    END $$
  `);

  // Migration: drop legacy account_id from users table if present
  await db.exec(`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'account_id'
      ) THEN
        ALTER TABLE users DROP COLUMN account_id;
      END IF;
    END $$
  `);

  // ── Request Logs ────────────────────────────────────────────────────
  await db.exec(`
    CREATE TABLE IF NOT EXISTS request_logs (
      id SERIAL PRIMARY KEY,
      api_key_id INTEGER REFERENCES api_keys(id) ON DELETE SET NULL,
      resource_id INTEGER REFERENCES resources(id) ON DELETE SET NULL,
      method TEXT NOT NULL,
      url TEXT NOT NULL,
      headers TEXT,
      body TEXT,
      response_code INTEGER,
      response_body TEXT,
      duration_ms INTEGER,
      upstream_status_code INTEGER,
      ip_address TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Additive migrations for existing request_logs tables
  await db.exec(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'request_logs' AND column_name = 'api_key_id'
      ) THEN
        ALTER TABLE request_logs ADD COLUMN api_key_id INTEGER REFERENCES api_keys(id) ON DELETE SET NULL;
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'request_logs' AND column_name = 'duration_ms'
      ) THEN
        ALTER TABLE request_logs ADD COLUMN duration_ms INTEGER;
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'request_logs' AND column_name = 'upstream_status_code'
      ) THEN
        ALTER TABLE request_logs ADD COLUMN upstream_status_code INTEGER;
      END IF;
    END $$
  `);

  // Backfill: copy use_case_id → api_key_id for existing logs
  await db.exec(`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'request_logs' AND column_name = 'use_case_id'
      ) THEN
        UPDATE request_logs SET api_key_id = use_case_id WHERE api_key_id IS NULL AND use_case_id IS NOT NULL;
      END IF;
    END $$
  `);

  // ── API Key Quotas (per-api-key usage & expiry tracking) ──────────
  await db.exec(`
    CREATE TABLE IF NOT EXISTS api_key_quotas (
      id SERIAL PRIMARY KEY,
      api_key_id INTEGER NOT NULL UNIQUE REFERENCES api_keys(id) ON DELETE CASCADE,
      usage_counts JSONB DEFAULT '{}',
      expiry_dates JSONB DEFAULT '{}',
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // ── Indexes ─────────────────────────────────────────────────────────
  await db.exec(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_ip_allowlists_name ON ip_allowlists(name)`,
  );
  await db.exec(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_ip_blocklists_name ON ip_blocklists(name)`,
  );
  await db.exec(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_key_rate_limits_name ON key_rate_limits(name)`,
  );
  await db.exec(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_endpoint_groups_resource_name ON endpoint_groups(resource_id, name)`,
  );
  await db.exec(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_presets_name ON presets(name)`,
  );
  await db.exec(
    `CREATE INDEX IF NOT EXISTS idx_api_keys_preset ON api_keys(preset_id)`,
  );
  await db.exec(
    `CREATE INDEX IF NOT EXISTS idx_request_logs_api_key_id ON request_logs(api_key_id)`,
  );
  await db.exec(
    `CREATE INDEX IF NOT EXISTS idx_request_logs_resource_id ON request_logs(resource_id)`,
  );
  await db.exec(
    `CREATE INDEX IF NOT EXISTS idx_request_logs_created_at ON request_logs(created_at DESC)`,
  );
  await db.exec(
    `CREATE INDEX IF NOT EXISTS idx_api_key_quotas_api_key ON api_key_quotas(api_key_id)`,
  );

  // ── Seed: single workspace organization (id = 1) ───────────────────
  const existingWorkspace = await db.get(
    "SELECT id FROM organization WHERE id = 1",
  );
  if (!existingWorkspace) {
    await db.run(
      "INSERT INTO organization (id, name) VALUES (1, 'KeyControl')",
    );
    // Reset the sequence so the next auto-generated id is 2+
    await db.exec(
      "SELECT setval('organization_id_seq', (SELECT COALESCE(MAX(id),1) FROM organization))",
    );
  }

  // Backfill organization_code for existing rows
  const orgsWithoutCode = await db.all(
    "SELECT id FROM organization WHERE organization_code IS NULL OR LENGTH(organization_code) < 6",
  );
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  for (const org of orgsWithoutCode) {
    const code = Array.from(crypto.randomBytes(6))
      .map((byte) => chars[byte % chars.length])
      .join("");
    await db.run(
      "UPDATE organization SET organization_code = $1 WHERE id = $2",
      [code, org.id],
    );
  }

  // ── Seed: admin password hash from ADMIN_TOKEN env (one-time bootstrap) ──
  const orgForPw = await db.get(
    "SELECT admin_password_hash FROM organization WHERE id = 1",
  );
  if (!orgForPw?.admin_password_hash && config.adminToken) {
    const hash = await bcrypt.hash(config.adminToken, 12);
    await db.run(
      "UPDATE organization SET admin_password_hash = $1 WHERE id = $2",
      [hash, 1],
    );
  }

  // ── Seed: default rate limit ────────────────────────────────────────
  const defaultRateLimit = await db.get(
    "SELECT id FROM key_rate_limits WHERE name = $1",
    ["Default Rate Limit"],
  );
  if (!defaultRateLimit) {
    const result = await db.run(
      "INSERT INTO key_rate_limits (name) VALUES ($1) RETURNING id",
      ["Default Rate Limit"],
    );
    const rateLimitId = result.insertedId;
    await db.run(
      "INSERT INTO rate_limit_rules (rate_limit_id, requests, window_seconds) VALUES ($1, $2, $3)",
      [rateLimitId, 10, 1],
    );
    await db.run(
      "INSERT INTO rate_limit_rules (rate_limit_id, requests, window_seconds) VALUES ($1, $2, $3)",
      [rateLimitId, 100, 60],
    );
  }

  // ── Seed: Strict Rate Limit ────────────────────────────────────────
  const strictRateLimit = await db.get(
    "SELECT id FROM key_rate_limits WHERE name = $1",
    ["Strict Rate Limit"],
  );
  if (!strictRateLimit) {
    const result = await db.run(
      "INSERT INTO key_rate_limits (name) VALUES ($1) RETURNING id",
      ["Strict Rate Limit"],
    );
    const rlId = result.insertedId;
    await db.run(
      "INSERT INTO rate_limit_rules (rate_limit_id, requests, window_seconds) VALUES ($1, $2, $3)",
      [rlId, 5, 1],
    );
    await db.run(
      "INSERT INTO rate_limit_rules (rate_limit_id, requests, window_seconds) VALUES ($1, $2, $3)",
      [rlId, 50, 60],
    );
    await db.run(
      "INSERT INTO rate_limit_rules (rate_limit_id, requests, window_seconds) VALUES ($1, $2, $3)",
      [rlId, 200, 3600],
    );
  }

  // ── Seed: Moderate Rate Limit ──────────────────────────────────────
  const moderateRateLimit = await db.get(
    "SELECT id FROM key_rate_limits WHERE name = $1",
    ["Moderate Rate Limit"],
  );
  if (!moderateRateLimit) {
    const result = await db.run(
      "INSERT INTO key_rate_limits (name) VALUES ($1) RETURNING id",
      ["Moderate Rate Limit"],
    );
    const rlId = result.insertedId;
    await db.run(
      "INSERT INTO rate_limit_rules (rate_limit_id, requests, window_seconds) VALUES ($1, $2, $3)",
      [rlId, 20, 1],
    );
    await db.run(
      "INSERT INTO rate_limit_rules (rate_limit_id, requests, window_seconds) VALUES ($1, $2, $3)",
      [rlId, 500, 60],
    );
    await db.run(
      "INSERT INTO rate_limit_rules (rate_limit_id, requests, window_seconds) VALUES ($1, $2, $3)",
      [rlId, 5000, 3600],
    );
  }

  // ── Seed: Permissive Rate Limit ────────────────────────────────────
  const permissiveRateLimit = await db.get(
    "SELECT id FROM key_rate_limits WHERE name = $1",
    ["Permissive Rate Limit"],
  );
  if (!permissiveRateLimit) {
    const result = await db.run(
      "INSERT INTO key_rate_limits (name) VALUES ($1) RETURNING id",
      ["Permissive Rate Limit"],
    );
    const rlId = result.insertedId;
    await db.run(
      "INSERT INTO rate_limit_rules (rate_limit_id, requests, window_seconds) VALUES ($1, $2, $3)",
      [rlId, 100, 1],
    );
    await db.run(
      "INSERT INTO rate_limit_rules (rate_limit_id, requests, window_seconds) VALUES ($1, $2, $3)",
      [rlId, 3000, 60],
    );
  }

  // ── Seed: IP Blocklists ────────────────────────────────────────────
  const blocklists = [
    {
      name: "Known Bad Actors",
      ips: "198.51.100.1",
      response_code: 403,
      response_body: '{"error": "IP blocked"}',
      response_type: "json",
    },
    {
      name: "Tor Exit Nodes",
      ips: "10.10.0.0/16",
      response_code: 403,
      response_body: '{"error": "IP blocked"}',
      response_type: "json",
    },
    {
      name: "Spam Networks",
      ips: "203.0.113.10,203.0.113.11,203.0.113.12",
      response_code: 403,
      response_body: '{"error": "IP blocked"}',
      response_type: "json",
    },
    {
      name: "Geo-Restricted",
      ips: "192.0.2.0/24",
      response_code: 451,
      response_body: '{"error": "Unavailable for legal reasons"}',
      response_type: "json",
    },
  ];
  for (const bl of blocklists) {
    const exists = await db.get(
      "SELECT id FROM ip_blocklists WHERE name = $1",
      [bl.name],
    );
    if (!exists) {
      await db.run(
        "INSERT INTO ip_blocklists (name, ips, response_code, response_body, response_type) VALUES ($1, $2, $3, $4, $5)",
        [bl.name, bl.ips, bl.response_code, bl.response_body, bl.response_type],
      );
    }
  }

  // ── Seed: IP Allowlists ────────────────────────────────────────────
  const allowlists = [
    {
      name: "Office Network",
      ips: "10.0.0.0/8",
      response_code: 403,
      response_body: '{"error": "IP not allowed"}',
      response_type: "json",
    },
    {
      name: "VPN Endpoints",
      ips: "172.16.0.1,172.16.0.2,172.16.0.3",
      response_code: 403,
      response_body: '{"error": "IP not allowed"}',
      response_type: "json",
    },
    {
      name: "Monitoring Service",
      ips: "198.51.100.50",
      response_code: 403,
      response_body: '{"error": "IP not allowed"}',
      response_type: "json",
    },
    {
      name: "Partner API Servers",
      ips: "203.0.113.100,203.0.113.0/28",
      response_code: 401,
      response_body: '{"error": "Unauthorized IP"}',
      response_type: "json",
    },
  ];
  for (const al of allowlists) {
    const exists = await db.get(
      "SELECT id FROM ip_allowlists WHERE name = $1",
      [al.name],
    );
    if (!exists) {
      await db.run(
        "INSERT INTO ip_allowlists (name, ips, response_code, response_body, response_type) VALUES ($1, $2, $3, $4, $5)",
        [al.name, al.ips, al.response_code, al.response_body, al.response_type],
      );
    }
  }

  // ── Seed: Master Access preset ────────────────────────────────────
  const masterPreset = await db.get(
    "SELECT id FROM presets WHERE is_full_access = TRUE",
  );
  if (!masterPreset) {
    await db.run(
      `INSERT INTO presets (name, description, is_full_access, is_system)
       VALUES ('Master Access', 'Full access to all resources and endpoint groups', TRUE, TRUE)
       ON CONFLICT DO NOTHING`,
    );
  } else {
    // Ensure existing Master Access preset is marked as system
    await db.run(
      "UPDATE presets SET is_system = TRUE WHERE is_full_access = TRUE AND (is_system IS NULL OR is_system = FALSE)",
    );
  }

  // ── Backfill: create api_key_quotas rows for existing api_keys ────
  await db.exec(`
    INSERT INTO api_key_quotas (api_key_id, usage_counts, expiry_dates)
    SELECT ak.id, '{}', '{}'
    FROM api_keys ak
    WHERE NOT EXISTS (
      SELECT 1 FROM api_key_quotas aq WHERE aq.api_key_id = ak.id
    )
  `);
}
