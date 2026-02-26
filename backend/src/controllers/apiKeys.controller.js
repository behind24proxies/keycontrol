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
    clauses.push(
      `(LOWER(ak.name) LIKE $${paramIndex} OR LOWER(ak.description) LIKE $${paramIndex})`,
    );
    params.push(`%${search.toLowerCase()}%`);
    paramIndex++;
  }
  if (preset_id) {
    clauses.push(`ak.preset_id = $${paramIndex++}`);
    params.push(parseInt(preset_id, 10));
  }

  const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";

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
  const { name, description, notes, preset_id } = req.body;

  // Validate preset exists
  const preset = await db.get("SELECT id FROM presets WHERE id = $1", [preset_id]);
  if (!preset) {
    throw AppError.badRequest("Preset not found");
  }

  const orgCode = await getOrgCode(db);
  const apiKeyValue = generateApiKey(orgCode);

  const result = await db.run(
    `INSERT INTO api_keys (preset_id, name, description, api_key, notes)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [preset_id, name, description || null, apiKeyValue, notes || null],
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
  const { name, description, notes, preset_id } = req.body;

  const existing = await db.get("SELECT * FROM api_keys WHERE id = $1", [id]);
  if (!existing) {
    throw AppError.notFound("API key not found");
  }

  // Validate preset if changing
  if (preset_id !== undefined) {
    const preset = await db.get("SELECT id FROM presets WHERE id = $1", [preset_id]);
    if (!preset) {
      throw AppError.badRequest("Preset not found");
    }
  }

  await db.run(
    `UPDATE api_keys
     SET name = COALESCE($1, name),
         description = $2,
         notes = $3,
         preset_id = COALESCE($4, preset_id)
     WHERE id = $5`,
    [
      name || existing.name,
      description !== undefined ? description : existing.description,
      notes !== undefined ? notes : existing.notes,
      preset_id || existing.preset_id,
      id,
    ],
  );

  const apiKey = await fetchApiKeyById(db, id);

  res.json(apiKey);
}

// ── POST /api-keys/:id/rotate-key ───────────────────────────────────
export async function rotateKey(req, res) {
  const db = getDb();
  const { id } = req.params;

  const existing = await db.get("SELECT * FROM api_keys WHERE id = $1", [id]);
  if (!existing) {
    throw AppError.notFound("API key not found");
  }

  const orgCode = await getOrgCode(db);
  const newKey = generateApiKey(orgCode);
  await db.run("UPDATE api_keys SET api_key = $1 WHERE id = $2", [newKey, id]);

  res.json({ api_key: newKey });
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
