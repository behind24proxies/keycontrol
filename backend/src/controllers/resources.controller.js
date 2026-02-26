import { getDb } from "../db/index.js";
import { AppError } from "../errors/AppError.js";

// ── GET /resources ────────────────────────────────────────────────────
export async function list(req, res) {
  const db = getDb();

  const resources = await db.all(
    `SELECT r.*,
            COALESCE(logs.cnt, 0)          AS total_usage_count,
            logs.last_used,
            COALESCE(eg.cnt, 0)            AS endpoint_groups_count
     FROM resources r
     LEFT JOIN (
       SELECT resource_id,
              COUNT(*)          AS cnt,
              MAX(created_at)   AS last_used
       FROM request_logs
       GROUP BY resource_id
     ) logs ON logs.resource_id = r.id
     LEFT JOIN (
       SELECT resource_id, COUNT(*) AS cnt
       FROM endpoint_groups
       GROUP BY resource_id
     ) eg ON eg.resource_id = r.id
     ORDER BY r.created_at DESC`,
  );

  const mappedResources = resources.map((r) => ({
    ...r,
    total_usage_count: parseInt(r.total_usage_count) || 0,
    endpoint_groups_count: parseInt(r.endpoint_groups_count) || 0,
    external_api_base_url: r.external_api_url,
  }));
  res.json(mappedResources);
}

// ── GET /resources/:id ────────────────────────────────────────────────
export async function getById(req, res) {
  const db = getDb();
  const { id } = req.params;

  const resource = await db.get(
    "SELECT * FROM resources WHERE id = $1",
    [id],
  );
  if (!resource) {
    throw AppError.notFound("Resource not found");
  }

  resource.external_api_base_url = resource.external_api_url;

  const endpointGroups = await db.all(
    "SELECT * FROM endpoint_groups WHERE resource_id = $1",
    [id],
  );
  for (const group of endpointGroups) {
    group.endpoints = await db.all(
      "SELECT * FROM endpoints WHERE endpoint_group_id = $1",
      [group.id],
    );
  }
  resource.endpoint_groups = endpointGroups;

  res.json(resource);
}

// ── POST /resources ───────────────────────────────────────────────────
export async function create(req, res) {
  const db = getDb();
  const {
    name,
    unique_path,
    secret_api_key,
    external_api_base_url,
    external_api_url,
    description,
    timeout_seconds,
    timeout_response_code,
    timeout_response_body,
    timeout_response_type,
  } = req.body;
  const apiUrl = external_api_base_url || external_api_url;

  // Check if unique_path already exists globally
  const existing = await db.get(
    "SELECT id, name FROM resources WHERE unique_path = $1",
    [unique_path],
  );
  if (existing) {
    throw AppError.conflict(
      `Path "${unique_path}" is already in use by resource "${existing.name}". Please choose a different path.`,
    );
  }

  const validTypes = ["json", "text", "xml"];
  const timeoutType =
    timeout_response_type && validTypes.includes(timeout_response_type)
      ? timeout_response_type
      : "json";

  try {
    const result = await db.run(
      `INSERT INTO resources (name, unique_path, secret_api_key, external_api_url, description, timeout_seconds, timeout_response_code, timeout_response_body, timeout_response_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [
        name,
        unique_path,
        secret_api_key,
        apiUrl,
        description || null,
        timeout_seconds || null,
        timeout_response_code || 504,
        timeout_response_body || '{"error": "Request timeout"}',
        timeoutType,
      ],
    );
    res.json({
      id: result.insertedId,
      name,
      unique_path,
      secret_api_key,
      external_api_base_url: apiUrl,
      description: description || null,
      timeout_seconds: timeout_seconds || null,
      timeout_response_code: timeout_response_code || 504,
      timeout_response_body:
        timeout_response_body || '{"error": "Request timeout"}',
      timeout_response_type: timeoutType,
    });
  } catch (error) {
    if (error.code === "23505") {
      throw AppError.conflict(
        `Path "${unique_path}" is already in use. Please choose a different path.`,
      );
    }
    throw error;
  }
}

// ── PUT /resources/:id ────────────────────────────────────────────────
export async function update(req, res) {
  const db = getDb();
  const { id } = req.params;
  const {
    name,
    secret_api_key,
    external_api_base_url,
    external_api_url,
    description,
    timeout_seconds,
    timeout_response_code,
    timeout_response_body,
    timeout_response_type,
  } = req.body;
  const apiUrl = external_api_base_url || external_api_url;

  const resource = await db.get(
    "SELECT unique_path FROM resources WHERE id = $1",
    [id],
  );
  if (!resource) {
    throw AppError.notFound("Resource not found");
  }

  const validTypes = ["json", "text", "xml"];
  const timeoutType =
    timeout_response_type && validTypes.includes(timeout_response_type)
      ? timeout_response_type
      : "json";

  await db.run(
    `UPDATE resources SET name = $1, secret_api_key = $2, external_api_url = $3, description = $4,
     timeout_seconds = $5, timeout_response_code = $6, timeout_response_body = $7, timeout_response_type = $8
     WHERE id = $9`,
    [
      name,
      secret_api_key,
      apiUrl,
      description || null,
      timeout_seconds || null,
      timeout_response_code || 504,
      timeout_response_body || '{"error": "Request timeout"}',
      timeoutType,
      id,
    ],
  );

  res.json({
    id,
    name,
    unique_path: resource.unique_path,
    secret_api_key,
    external_api_base_url: apiUrl,
    description: description || null,
    timeout_seconds: timeout_seconds || null,
    timeout_response_code: timeout_response_code || 504,
    timeout_response_body:
      timeout_response_body || '{"error": "Request timeout"}',
    timeout_response_type: timeoutType,
  });
}

// ── DELETE /resources/:id ─────────────────────────────────────────────
export async function remove(req, res) {
  const db = getDb();
  const { id } = req.params;

  const resource = await db.get(
    "SELECT id FROM resources WHERE id = $1",
    [id],
  );
  if (!resource) {
    throw AppError.notFound("Resource not found");
  }

  // Nullify request_logs references so deletion isn't blocked by FK
  await db.run(
    "UPDATE request_logs SET resource_id = NULL WHERE resource_id = $1",
    [id],
  );

  await db.run("DELETE FROM resources WHERE id = $1", [id]);
  res.json({ success: true });
}
