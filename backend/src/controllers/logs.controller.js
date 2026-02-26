import { getDb } from "../db/index.js";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";
import { getOrg, updateOrgSetting } from "../services/org.service.js";

// ── GET /logs ─────────────────────────────────────────────────────────
// Admin-only: all logs scoped to the account's resources.
// Returns { logs, pagination }.
export async function list(req, res) {
  const db = getDb();
  const {
    resource_id,
    api_key_id,
    method,
    status_code,
    date_from,
    date_to,
    page,
    per_page,
  } = req.query;

  const clauses = [];
  const params = [];
  let paramIndex = 1;

  // ── Filters ──────────────────────────────────────────────────────────
  if (resource_id) {
    clauses.push(`rl.resource_id = $${paramIndex++}`);
    params.push(resource_id);
  }
  if (api_key_id) {
    clauses.push(`rl.api_key_id = $${paramIndex++}`);
    params.push(api_key_id);
  }
  if (method) {
    clauses.push(`UPPER(rl.method) = UPPER($${paramIndex++})`);
    params.push(method);
  }
  if (status_code) {
    clauses.push(`rl.response_code = $${paramIndex++}`);
    params.push(parseInt(status_code, 10));
  }
  if (date_from) {
    clauses.push(`rl.created_at >= $${paramIndex++}`);
    params.push(new Date(date_from));
  }
  if (date_to) {
    clauses.push(`rl.created_at <= $${paramIndex++}`);
    params.push(new Date(date_to));
  }

  const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";

  // ── Count ────────────────────────────────────────────────────────────
  const countSql = `SELECT COUNT(*) AS total FROM request_logs rl ${whereClause}`;
  const countResult = await db.get(countSql, params);
  const total = parseInt(countResult?.total, 10) || 0;

  // ── Pagination ───────────────────────────────────────────────────────
  const perPage = Math.min(parseInt(per_page, 10) || 50, 200);
  const currentPage = Math.max(parseInt(page, 10) || 1, 1);
  const offset = (currentPage - 1) * perPage;
  const totalPages = Math.ceil(total / perPage);

  const dataSql = `
    SELECT rl.* FROM request_logs rl
    ${whereClause}
    ORDER BY rl.created_at DESC
    LIMIT $${paramIndex++} OFFSET $${paramIndex++}
  `;
  params.push(perPage, offset);

  const logs = await db.all(dataSql, params);

  res.json({
    logs,
    pagination: {
      page: currentPage,
      per_page: perPage,
      total,
      total_pages: totalPages,
    },
  });
}

// ── GET /logs/stats ───────────────────────────────────────────────────
// Dashboard aggregate stats for the account.
export async function getStats(req, res) {
  const db = getDb();
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [apiKeyCount, resourceCount, presetCount, requestStats, recentLogs] = await Promise.all([
    db.get("SELECT COUNT(*) AS count FROM api_keys"),
    db.get("SELECT COUNT(*) AS count FROM resources"),
    db.get("SELECT COUNT(*) AS count FROM presets"),
    db.get(`
      SELECT
        COUNT(*) AS total_requests,
        COALESCE(AVG(rl.duration_ms), 0) AS avg_response_time,
        COUNT(*) FILTER (WHERE rl.response_code >= 200 AND rl.response_code < 300) AS success_count,
        COUNT(*) FILTER (WHERE rl.response_code >= 400 AND rl.response_code < 500) AS client_error_count,
        COUNT(*) FILTER (WHERE rl.response_code >= 500) AS server_error_count
      FROM request_logs rl
      WHERE rl.created_at >= $1
    `, [twentyFourHoursAgo]),
    db.all(`
      SELECT rl.* FROM request_logs rl
      ORDER BY rl.created_at DESC
      LIMIT 10
    `),
  ]);

  res.json({
    api_key_count: parseInt(apiKeyCount?.count, 10) || 0,
    resource_count: parseInt(resourceCount?.count, 10) || 0,
    preset_count: parseInt(presetCount?.count, 10) || 0,
    requests_24h: parseInt(requestStats?.total_requests, 10) || 0,
    avg_response_time_ms: Math.round(parseFloat(requestStats?.avg_response_time) || 0),
    success_count: parseInt(requestStats?.success_count, 10) || 0,
    client_error_count: parseInt(requestStats?.client_error_count, 10) || 0,
    server_error_count: parseInt(requestStats?.server_error_count, 10) || 0,
    recent_logs: recentLogs || [],
  });
}

// ── GET /logs/settings ────────────────────────────────────────────────
export async function getSettings(req, res) {
  const db = getDb();
  const org = await getOrg(db);
  res.json({ log_ip_addresses: org?.log_ip_addresses === 1 });
}

// ── PUT /logs/settings ────────────────────────────────────────────────
export async function updateSettings(req, res) {
  const db = getDb();
  const { log_ip_addresses } = req.body;
  await updateOrgSetting("log_ip_addresses", log_ip_addresses ? 1 : 0, db);
  res.json({ success: true, log_ip_addresses: !!log_ip_addresses });
}

// ── Auto-delete old logs ──────────────────────────────────────────────
// Deletes request_logs older than the configured retention period.
// Retention is set via LOG_RETENTION_SECONDS env var (default: 30 days).
export async function pruneOldLogs() {
  try {
    const db = getDb();
    const cutoff = new Date(Date.now() - config.logRetentionSeconds * 1000);
    const result = await db.run(
      "DELETE FROM request_logs WHERE created_at < $1",
      [cutoff],
    );
    const deleted = result.rowCount || 0;
    if (deleted > 0) {
      const days = Math.round(config.logRetentionSeconds / 86400);
      logger.info(`Pruned ${deleted} request logs older than ${days} days`);
    }
  } catch (err) {
    logger.error("Failed to prune old logs:", err.message);
  }
}

// ── Start the auto-prune interval ─────────────────────────────────────
let pruneTimer = null;
export function startLogPruning(intervalMs = 24 * 60 * 60 * 1000) {
  // Run once immediately, then on interval
  pruneOldLogs();
  pruneTimer = setInterval(pruneOldLogs, intervalMs);
  if (pruneTimer.unref) pruneTimer.unref();
}

export function stopLogPruning() {
  if (pruneTimer) {
    clearInterval(pruneTimer);
    pruneTimer = null;
  }
}
