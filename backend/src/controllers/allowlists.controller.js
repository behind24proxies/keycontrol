import { getDb } from "../db/index.js";
import { AppError } from "../errors/AppError.js";

// ── GET /ip-allowlists ────────────────────────────────────────────────
export async function list(req, res) {
  const db = getDb();
  const allowlists = await db.all(
    `SELECT a.*,
            COUNT(DISTINCT p.id)          AS preset_count,
            STRING_AGG(DISTINCT p.name, ',') AS preset_names
     FROM ip_allowlists a
     LEFT JOIN presets p ON p.ip_allowlist_id = a.id
     GROUP BY a.id
     ORDER BY a.created_at DESC`,
  );

  for (const row of allowlists) {
    row.usage = {
      preset_count: parseInt(row.preset_count) || 0,
      preset_names: row.preset_names ? row.preset_names.split(",") : [],
    };
    delete row.preset_count;
    delete row.preset_names;
  }

  res.json(allowlists);
}

// ── POST /ip-allowlists ──────────────────────────────────────────────
export async function create(req, res) {
  const db = getDb();
  const { name, ips, response_body } = req.body;

  // System-locked values — not user-configurable
  const response_code = 403;
  const response_type = "json";

  const existing = await db.get(
    "SELECT id FROM ip_allowlists WHERE name = $1",
    [name],
  );
  if (existing) {
    throw AppError.conflict("IP allowlist name already exists");
  }

  const result = await db.run(
    "INSERT INTO ip_allowlists (name, ips, response_code, response_body, response_type) VALUES ($1, $2, $3, $4, $5) RETURNING id",
    [
      name,
      ips,
      response_code,
      response_body || '{"error": "IP not allowed"}',
      response_type,
    ],
  );

  res.status(201).json({
    id: result.insertedId,
    name,
    ips,
    response_code,
    response_body: response_body || '{"error": "IP not allowed"}',
    response_type,
  });
}

// ── PUT /ip-allowlists/:id ───────────────────────────────────────────
export async function update(req, res) {
  const db = getDb();
  const { id } = req.params;
  const { name, ips, response_body } = req.body;

  // System-locked values — not user-configurable
  const response_code = 403;
  const response_type = "json";

  const allowlist = await db.get(
    "SELECT id FROM ip_allowlists WHERE id = $1",
    [id],
  );
  if (!allowlist) {
    throw AppError.notFound("IP allowlist not found");
  }

  const duplicate = await db.get(
    "SELECT id FROM ip_allowlists WHERE name = $1 AND id != $2",
    [name, id],
  );
  if (duplicate) {
    throw AppError.conflict("IP allowlist name already exists");
  }

  await db.run(
    "UPDATE ip_allowlists SET name = $1, ips = $2, response_code = $3, response_body = $4, response_type = $5 WHERE id = $6",
    [name, ips, response_code, response_body, response_type, id],
  );

  res.json({
    id,
    name,
    ips,
    response_code,
    response_body,
    response_type,
  });
}

// ── GET /ip-allowlists/:id/associated-presets ────────────────────────
export async function getAssociatedPresets(req, res) {
  const db = getDb();
  const { id } = req.params;

  const associatedPresets = await db.all(
    `SELECT p.id, p.name FROM presets p WHERE p.ip_allowlist_id = $1`,
    [id],
  );

  res.json({ associated_presets: associatedPresets });
}

// ── DELETE /ip-allowlists/:id ────────────────────────────────────────
export async function remove(req, res) {
  const db = getDb();
  const { id } = req.params;

  const allowlist = await db.get(
    "SELECT id FROM ip_allowlists WHERE id = $1",
    [id],
  );
  if (!allowlist) {
    throw AppError.notFound("IP allowlist not found");
  }

  const associatedPresets = await db.all(
    `SELECT p.id, p.name FROM presets p WHERE p.ip_allowlist_id = $1`,
    [id],
  );

  if (associatedPresets.length > 0) {
    throw AppError.badRequest(
      `Cannot delete IP allowlist: ${associatedPresets.length} preset(s) are using it.`,
    );
  }

  await db.run("DELETE FROM ip_allowlists WHERE id = $1", [id]);
  res.json({ success: true });
}
