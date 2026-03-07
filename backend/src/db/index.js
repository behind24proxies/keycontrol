import pg from "pg";
import { config } from "../config/index.js";
import { initSchema } from "./schema.js";

// Parse int8 / BIGINT (type OID 20) as JavaScript numbers.
// Without this, COUNT(*) and BIGINT columns return strings.
pg.types.setTypeParser(20, (val) => parseInt(val, 10));

let pool = null;
let db = null;

/**
 * Thin async wrapper around a pg Pool (or Client) that exposes
 * .get(), .all(), .run(), .exec() convenience methods.
 *
 * All SQL must use native Postgres $1, $2, … placeholders and
 * parameters must be passed as a single array.
 */
class DbWrapper {
  constructor(clientOrPool) {
    this._client = clientOrPool;
  }

  /** Return the first matching row, or undefined. */
  async get(sql, params = []) {
    const { rows } = await this._client.query(sql, params);
    return rows[0] || undefined;
  }

  /** Return all matching rows. */
  async all(sql, params = []) {
    const { rows } = await this._client.query(sql, params);
    return rows;
  }

  /**
   * Execute a write statement (INSERT / UPDATE / DELETE).
   * Returns { rowCount, insertedId }.
   * If you need the inserted ID, add `RETURNING id` to your SQL.
   */
  async run(sql, params = []) {
    const result = await this._client.query(sql, params);
    return {
      rowCount: result.rowCount,
      insertedId: result.rows[0]?.id,
    };
  }

  /** Execute raw SQL (DDL, multi-statement schema scripts, etc.). */
  async exec(sql) {
    await this._client.query(sql);
  }

  /**
   * Run `fn` inside a database transaction.
   * `fn` receives a transaction-scoped DbWrapper backed by a single client.
   */
  async transaction(fn) {
    if (!pool) throw new Error("Pool not initialized");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const txDb = new DbWrapper(client);
      await fn(txDb);
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
}

/**
 * Initialize the database pool and run schema migrations.
 */
export async function initDb(databaseUrl, { skipSchema = false } = {}) {
  const url = databaseUrl || config.databaseUrl;

  const poolConfig = { connectionString: url };

  // SSL for Postgres connections:
  //   DATABASE_SSL=false  → explicitly disabled (Docker-internal, no SSL needed)
  //   DATABASE_SSL=true   → explicitly enabled
  //   unset               → auto-detect from URL params or NODE_ENV=production
  const sslExplicit = config.databaseSsl;
  const sslEnabled =
    sslExplicit !== undefined
      ? sslExplicit !== "false"
      : url.includes("sslmode=require") ||
        url.includes("ssl=true") ||
        config.isProd;

  if (sslEnabled) {
    poolConfig.ssl = { rejectUnauthorized: false };
  }

  pool = new pg.Pool(poolConfig);
  db = new DbWrapper(pool);

  if (!skipSchema) {
    await initSchema(db);
  }

  return db;
}

/**
 * Get the current database wrapper instance.
 */
export function getDb() {
  if (!db) {
    throw new Error("Database not initialized. Call initDb() first.");
  }
  return db;
}

/**
 * Replace the current database wrapper (used for testing).
 */
export function setDb(newDb) {
  db = newDb;
}

/**
 * Close the connection pool.
 */
export async function closeDb() {
  if (pool) {
    await pool.end();
    pool = null;
    db = null;
  }
}
