/**
 * Database lifecycle management for integration tests.
 *
 * Connects to the real Postgres test database, truncates all tables between
 * test files, and re-seeds the workspace organization. This ensures each
 * test file starts with a clean slate without the overhead of DROP/CREATE.
 */
import { initDb, closeDb } from "../../src/db/index.js";
import { createApp } from "../../src/app.js";
import { afterAll } from "vitest";
import { DEFAULT_ORG } from "./constants.js";

const TEST_DATABASE_URL =
  process.env.DATABASE_URL_TEST ||
  "postgresql://postgres:postgres@localhost:5433/keycontrol_test";

if (!process.env.DATABASE_URL_TEST) {
  console.warn(
    "\n⚠️  DATABASE_URL_TEST is not set. Falling back to default: " +
      TEST_DATABASE_URL +
      "\n   Set DATABASE_URL_TEST in your .env to use a custom test database.\n",
  );
}

/**
 * Spin up a fresh Postgres DB + Express app for an integration test file.
 * Truncates all data and re-seeds the organization.
 *
 * @returns {{ app: Express, db: DbWrapper }}
 */
export async function createTestEnv() {
  const db = await initDb(TEST_DATABASE_URL, { skipSchema: true });

  // Truncate all data and reset serial sequences
  await db.exec(`
    TRUNCATE TABLE
      request_logs,
      api_key_quotas,
      api_keys,
      preset_endpoint_groups,
      preset_resources,
      endpoints,
      endpoint_groups,
      rate_limit_rules,
      presets,
      resources,
      key_rate_limits,
      ip_allowlists,
      ip_blocklists,
      organization
    RESTART IDENTITY CASCADE
  `);

  // Re-seed the workspace organization (id = 1)
  await db.run(
    `INSERT INTO organization (id, name, organization_code) VALUES (1, $1, $2)`,
    [DEFAULT_ORG.name, DEFAULT_ORG.code],
  );
  await db.exec(
    "SELECT setval('organization_id_seq', (SELECT COALESCE(MAX(id),1) FROM organization))",
  );

  // Re-seed the Master Access system preset
  await db.run(
    `INSERT INTO presets (name, description, is_full_access, is_system)
     VALUES ('Master Access', 'Full access to all resources and endpoint groups', TRUE, TRUE)`,
  );

  const app = createApp();

  afterAll(async () => {
    await closeDb();
  });

  return { app, db };
}
