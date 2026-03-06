import { getDb } from "../db/index.js";
import { AppError } from "../errors/AppError.js";
import { generateApiKey } from "../utils/crypto.js";
import { getOrgCode } from "../services/org.service.js";

// ── Shared helper ─────────────────────────────────────────────────────
const API_KEY_SELECT = `
  SELECT ak.*,
         pr.name AS preset_name
  FROM api_keys ak
  LEFT JOIN presets pr ON ak.preset_id = pr.id
  WHERE ak.id = $1`;

async function fetchApiKeyById(db, id) {
  return db.get(API_KEY_SELECT, [id]);
}

// ── GET /api-keys ───────────────────────────────────────────────────
export async function list(req, res) {
  const db = getDb();
  const { search, preset_id, page, per_page } = req.query;

  const clauses = [];
  const params = [];
  let paramIndex = 1;

  if (search) {
    // Escape SQL LIKE special characters so they are treated as literals
    const escaped = search.toLowerCase().replace(/[%_\\]/g, "\\$&");
    clauses.push(
      `(LOWER(ak.name) LIKE $${paramIndex} ESCAPE '\\' OR LOWER(ak.description) LIKE $${paramIndex} ESCAPE '\\')`,
    );
    params.push(`%${escaped}%`);
    paramIndex++;
  }
  if (preset_id) {
    clauses.push(`ak.preset_id = $${paramIndex++}`);
    params.push(parseInt(preset_id, 10));
  }

  const whereClause =
    clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";

  // Count
  const countSql = `SELECT COUNT(*) AS total FROM api_keys ak ${whereClause}`;
  const countResult = await db.get(countSql, params);
  const total = parseInt(countResult?.total, 10) || 0;

  // Pagination
  const perPage = Math.min(parseInt(per_page, 10) || 25, 200);
  const currentPage = Math.max(parseInt(page, 10) || 1, 1);
  const offset = (currentPage - 1) * perPage;
  const totalPages = Math.ceil(total / perPage);

  const dataSql = `
    SELECT ak.*,
           pr.name AS preset_name
    FROM api_keys ak
    LEFT JOIN presets pr ON ak.preset_id = pr.id
    ${whereClause}
    ORDER BY ak.created_at DESC
    LIMIT $${paramIndex++} OFFSET $${paramIndex++}
  `;
  params.push(perPage, offset);

  const apiKeys = await db.all(dataSql, params);

  res.json({
    api_keys: apiKeys,
    pagination: {
      page: currentPage,
      per_page: perPage,
      total,
      total_pages: totalPages,
    },
  });
}

// ── GET /api-keys/:id ───────────────────────────────────────────────
export async function get(req, res) {
  const db = getDb();
  const { id } = req.params;

  const apiKey = await fetchApiKeyById(db, id);

  if (!apiKey) {
    throw AppError.notFound("API key not found");
  }

  res.json(apiKey);
}

// ── POST /api-keys ──────────────────────────────────────────────────
export async function create(req, res) {
  const db = getDb();
  const { name, description, notes, preset_id, usage_limit, lease_duration_seconds } = req.body;

  // Validate preset exists
  const preset = await db.get("SELECT id FROM presets WHERE id = $1", [
    preset_id,
  ]);
  if (!preset) {
    throw AppError.badRequest("Preset not found");
  }

  const orgCode = await getOrgCode(db);
  const apiKeyValue = generateApiKey(orgCode);

  const result = await db.run(
    `INSERT INTO api_keys (preset_id, name, description, api_key, notes, usage_limit, lease_duration_seconds)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [
      preset_id,
      name,
      description || null,
      apiKeyValue,
      notes || null,
      usage_limit ?? null,
      lease_duration_seconds ?? null,
    ],
  );

  // Create corresponding api_key_quotas row
  await db.run(
    `INSERT INTO api_key_quotas (api_key_id, usage_counts, expiry_dates)
     VALUES ($1, '{}', '{}')
     ON CONFLICT (api_key_id) DO NOTHING`,
    [result.insertedId],
  );

  const apiKey = await fetchApiKeyById(db, result.insertedId);

  res.status(201).json(apiKey);
}

// ── PUT /api-keys/:id ───────────────────────────────────────────────
export async function update(req, res) {
  const db = getDb();
  const { id } = req.params;
  const { name, description, notes, preset_id, usage_limit, lease_duration_seconds } = req.body;

  const existing = await db.get("SELECT * FROM api_keys WHERE id = $1", [id]);
  if (!existing) {
    throw AppError.notFound("API key not found");
  }

  // Validate preset if changing
  if (preset_id !== undefined) {
    const preset = await db.get("SELECT id FROM presets WHERE id = $1", [
      preset_id,
    ]);
    if (!preset) {
      throw AppError.badRequest("Preset not found");
    }
  }

  await db.run(
    `UPDATE api_keys
     SET name = COALESCE($1, name),
         description = $2,
         notes = $3,
         preset_id = COALESCE($4, preset_id),
         usage_limit = $6,
         lease_duration_seconds = $7
     WHERE id = $5`,
    [
      name || existing.name,
      description !== undefined ? description : existing.description,
      notes !== undefined ? notes : existing.notes,
      preset_id || existing.preset_id,
      id,
      usage_limit !== undefined ? (usage_limit ?? null) : existing.usage_limit,
      lease_duration_seconds !== undefined ? (lease_duration_seconds ?? null) : existing.lease_duration_seconds,
    ],
  );

  // If quota fields were cleared, also clean up any stale global quota tracking
  if (usage_limit === null && lease_duration_seconds === null) {
    await db.run(
      `UPDATE api_key_quotas
       SET usage_counts = usage_counts - 'global',
           expiry_dates = expiry_dates - 'global',
           updated_at = NOW()
       WHERE api_key_id = $1`,
      [id],
    );
  }

  const apiKey = await fetchApiKeyById(db, id);

  res.json(apiKey);
}


// ── GET /api-keys/:id/stats ─────────────────────────────────────────
export async function stats(req, res) {
  const db = getDb();
  const { id } = req.params;

  const existing = await db.get(
    "SELECT id, usage_limit, lease_duration_seconds FROM api_keys WHERE id = $1",
    [id],
  );
  if (!existing) {
    throw AppError.notFound("API key not found");
  }

  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [allTime, last24h, last7d, last30d, quotaRow, topResources] =
    await Promise.all([
      // All-time stats
      db.get(
        `
      SELECT
        COUNT(*) AS total_requests,
        COALESCE(AVG(duration_ms), 0) AS avg_response_time,
        COUNT(*) FILTER (WHERE response_code >= 200 AND response_code < 300) AS success_count,
        COUNT(*) FILTER (WHERE response_code >= 400 AND response_code < 500) AS client_error_count,
        COUNT(*) FILTER (WHERE response_code >= 500) AS server_error_count
      FROM request_logs WHERE api_key_id = $1
    `,
        [id],
      ),
      // Last 24h
      db.get(
        `
      SELECT COUNT(*) AS total_requests
      FROM request_logs WHERE api_key_id = $1 AND created_at >= $2
    `,
        [id, twentyFourHoursAgo],
      ),
      // Last 7 days
      db.get(
        `
      SELECT COUNT(*) AS total_requests
      FROM request_logs WHERE api_key_id = $1 AND created_at >= $2
    `,
        [id, sevenDaysAgo],
      ),
      // Last 30 days
      db.get(
        `
      SELECT COUNT(*) AS total_requests
      FROM request_logs WHERE api_key_id = $1 AND created_at >= $2
    `,
        [id, thirtyDaysAgo],
      ),
      // Quota usage
      db.get(
        `
      SELECT usage_counts, expiry_dates
      FROM api_key_quotas WHERE api_key_id = $1
    `,
        [id],
      ),
      // Top resources by usage
      db.all(
        `
      SELECT r.name AS resource_name, COUNT(*) AS request_count
      FROM request_logs rl
      JOIN resources r ON rl.resource_id = r.id
      WHERE rl.api_key_id = $1
      GROUP BY r.id, r.name
      ORDER BY request_count DESC
      LIMIT 5
    `,
        [id],
      ),
    ]);

  // Parse quota JSONB
  let usageCounts = {};
  let expiryDates = {};
  if (quotaRow) {
    usageCounts =
      typeof quotaRow.usage_counts === "string"
        ? JSON.parse(quotaRow.usage_counts)
        : quotaRow.usage_counts || {};
    expiryDates =
      typeof quotaRow.expiry_dates === "string"
        ? JSON.parse(quotaRow.expiry_dates)
        : quotaRow.expiry_dates || {};
  }

  res.json({
    total_requests: parseInt(allTime?.total_requests, 10) || 0,
    avg_response_time_ms: Math.round(
      parseFloat(allTime?.avg_response_time) || 0,
    ),
    success_count: parseInt(allTime?.success_count, 10) || 0,
    client_error_count: parseInt(allTime?.client_error_count, 10) || 0,
    server_error_count: parseInt(allTime?.server_error_count, 10) || 0,
    requests_24h: parseInt(last24h?.total_requests, 10) || 0,
    requests_7d: parseInt(last7d?.total_requests, 10) || 0,
    requests_30d: parseInt(last30d?.total_requests, 10) || 0,
    top_resources: (topResources || []).map((r) => ({
      resource_name: r.resource_name,
      request_count: parseInt(r.request_count, 10) || 0,
    })),
    usage_counts: usageCounts,
    expiry_dates: expiryDates,
    // Per-key quota config (null = unlimited)
    usage_limit: existing.usage_limit ?? null,
    lease_duration_seconds: existing.lease_duration_seconds ?? null,
    global_usage_count: usageCounts["global"] || 0,
    global_expiry_date: expiryDates["global"] || null,
  });
}

// ── DELETE /api-keys/:id ────────────────────────────────────────────
export async function remove(req, res) {
  const db = getDb();
  const { id } = req.params;

  const existing = await db.get("SELECT id FROM api_keys WHERE id = $1", [id]);
  if (!existing) {
    throw AppError.notFound("API key not found");
  }

  await db.run("DELETE FROM api_keys WHERE id = $1", [id]);
  res.json({ success: true });
}
