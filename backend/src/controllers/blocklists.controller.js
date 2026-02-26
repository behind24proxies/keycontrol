import { getDb } from "../db/index.js";
import { AppError } from "../errors/AppError.js";

// ── GET /ip-blocklists ────────────────────────────────────────────────
export async function list(req, res) {
  const db = getDb();
  const blocklists = await db.all(
    `SELECT b.*,
            COUNT(DISTINCT p.id)          AS preset_count,
            STRING_AGG(DISTINCT p.name, ',') AS preset_names
     FROM ip_blocklists b
     LEFT JOIN presets p ON p.ip_blocklist_id = b.id
     GROUP BY b.id
     ORDER BY b.created_at DESC`,
  );

  for (const row of blocklists) {
    row.usage = {
      preset_count: parseInt(row.preset_count) || 0,
      preset_names: row.preset_names ? row.preset_names.split(",") : [],
    };
    delete row.preset_count;
    delete row.preset_names;
  }

  res.json(blocklists);
}

// ── POST /ip-blocklists ───────────────────────────────────────────────
export async function create(req, res) {
  const db = getDb();
  const { name, ips, response_body } = req.body;

  // System-locked values — not user-configurable
  const response_code = 403;
  const response_type = "json";

  const existing = await db.get(
    "SELECT id FROM ip_blocklists WHERE name = $1",
    [name],
  );
  if (existing) {
    throw AppError.conflict("IP blocklist name already exists");
  }

  const result = await db.run(
    "INSERT INTO ip_blocklists (name, ips, response_code, response_body, response_type) VALUES ($1, $2, $3, $4, $5) RETURNING id",
    [
      name,
      ips,
      response_code,
      response_body || '{"error": "IP blocked"}',
      response_type,
    ],
  );

  res.status(201).json({
    id: result.insertedId,
    name,
    ips,
    response_code,
    response_body: response_body || '{"error": "IP blocked"}',
    response_type,
  });
}

// ── PUT /ip-blocklists/:id ────────────────────────────────────────────
export async function update(req, res) {
  const db = getDb();
  const { id } = req.params;
  const { name, ips, response_body } = req.body;

  // System-locked values — not user-configurable
  const response_code = 403;
  const response_type = "json";

  const blocklist = await db.get(
    "SELECT id FROM ip_blocklists WHERE id = $1",
    [id],
  );
  if (!blocklist) {
    throw AppError.notFound("IP blocklist not found");
  }

  const duplicate = await db.get(
    "SELECT id FROM ip_blocklists WHERE name = $1 AND id != $2",
    [name, id],
  );
  if (duplicate) {
    throw AppError.conflict("IP blocklist name already exists");
  }

  await db.run(
    "UPDATE ip_blocklists SET name = $1, ips = $2, response_code = $3, response_body = $4, response_type = $5 WHERE id = $6",
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

// ── GET /ip-blocklists/:id/associated-presets ─────────────────────────
export async function getAssociatedPresets(req, res) {
  const db = getDb();
  const { id } = req.params;

  const associatedPresets = await db.all(
    `SELECT p.id, p.name FROM presets p WHERE p.ip_blocklist_id = $1`,
    [id],
  );

  res.json({ associated_presets: associatedPresets });
}

// ── DELETE /ip-blocklists/:id ─────────────────────────────────────────
export async function remove(req, res) {
  const db = getDb();
  const { id } = req.params;

  const blocklist = await db.get(
    "SELECT id FROM ip_blocklists WHERE id = $1",
    [id],
  );
  if (!blocklist) {
    throw AppError.notFound("IP blocklist not found");
  }

  const associatedPresets = await db.all(
    `SELECT p.id, p.name FROM presets p WHERE p.ip_blocklist_id = $1`,
    [id],
  );

  if (associatedPresets.length > 0) {
    throw AppError.badRequest(
      `Cannot delete IP blocklist: ${associatedPresets.length} preset(s) are using it.`,
    );
  }

  await db.run("DELETE FROM ip_blocklists WHERE id = $1", [id]);
  res.json({ success: true });
}
