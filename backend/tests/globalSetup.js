/**
 * Vitest global setup – runs once before all test files.
 * Initialises the Postgres schema so individual test files only need
 * to truncate & seed data instead of racing on DDL.
 */
import { initDb, closeDb } from "../src/db/index.js";

const TEST_DATABASE_URL =
  process.env.DATABASE_URL_TEST ||
  "postgresql://postgres:postgres@localhost:5433/keycontrol_test";

if (!process.env.DATABASE_URL_TEST) {
  console.warn(
    "\n⚠️  DATABASE_URL_TEST is not set. Falling back to default: " +
    TEST_DATABASE_URL +
    "\n   Set DATABASE_URL_TEST in your .env to use a custom test database.\n"
  );
}

export async function setup() {
  // Run full schema creation once
  await initDb(TEST_DATABASE_URL);
  await closeDb();
}
