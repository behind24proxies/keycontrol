import { getDb } from "../db/index.js";
import { AppError } from "../errors/AppError.js";

// ── GET /rate-limits ──────────────────────────────────────────────────
export async function list(req, res) {
  const db = getDb();

  // Fetch all rate limits with usage stats in a single query
  const rateLimitsRaw = await db.all(
    `SELECT rl.*,
            COUNT(DISTINCT p.id)          AS preset_count,
            STRING_AGG(DISTINCT p.name, ',') AS preset_names
     FROM key_rate_limits rl
     LEFT JOIN presets p ON p.rate_limit_id = rl.id
     GROUP BY rl.id
     ORDER BY rl.created_at DESC`,
  );

  // Fetch ALL rules in a single query, keyed by rate_limit_id
  const allRules = await db.all(
    "SELECT * FROM rate_limit_rules ORDER BY rate_limit_id, window_seconds ASC",
  );
  const rulesMap = new Map();
  for (const rule of allRules) {
    if (!rulesMap.has(rule.rate_limit_id)) rulesMap.set(rule.rate_limit_id, []);
    rulesMap.get(rule.rate_limit_id).push(rule);
  }

  for (const rl of rateLimitsRaw) {
    rl.rules = rulesMap.get(rl.id) || [];
    rl.usage = {
      preset_count: parseInt(rl.preset_count) || 0,
      preset_names: rl.preset_names ? rl.preset_names.split(",") : [],
    };
    delete rl.preset_count;
    delete rl.preset_names;
  }

  res.json(rateLimitsRaw);
}

// ── POST /rate-limits ─────────────────────────────────────────────────
export async function create(req, res) {
  const db = getDb();
  const { name, rules, response_body } = req.body;

  // System-locked values — not user-configurable
  const response_code = 429;
  const response_type = "json";

  const existing = await db.get(
    "SELECT id FROM key_rate_limits WHERE name = $1",
    [name],
  );
  if (existing) {
    throw AppError.conflict("Rate limit name already exists");
  }

  let rateLimitId;
  await db.transaction(async (txDb) => {
    const result = await txDb.run(
      "INSERT INTO key_rate_limits (name, response_code, response_body, response_type) VALUES ($1, $2, $3, $4) RETURNING id",
      [
        name,
        response_code,
        response_body || '{"error": "Rate limit exceeded"}',
        response_type,
      ],
    );
    rateLimitId = result.insertedId;

    for (const rule of rules || []) {
      await txDb.run(
        "INSERT INTO rate_limit_rules (rate_limit_id, requests, window_seconds) VALUES ($1, $2, $3)",
        [rateLimitId, rule.requests, rule.window_seconds],
      );
    }
  });

  res.status(201).json({
    id: rateLimitId,
    name,
    rules,
    response_code,
    response_body: response_body || '{"error": "Rate limit exceeded"}',
    response_type,
  });
}

// ── PUT /rate-limits/:id ──────────────────────────────────────────────
export async function update(req, res) {
  const db = getDb();
  const { id } = req.params;
  const { name, rules, response_body } = req.body;

  // System-locked values — not user-configurable
  const response_code = 429;
  const response_type = "json";

  const rateLimit = await db.get(
    "SELECT id FROM key_rate_limits WHERE id = $1",
    [id],
  );
  if (!rateLimit) {
    throw AppError.notFound("Rate limit not found");
  }

  const duplicate = await db.get(
    "SELECT id FROM key_rate_limits WHERE name = $1 AND id != $2",
    [name, id],
  );
  if (duplicate) {
    throw AppError.conflict("Rate limit name already exists");
  }

  await db.transaction(async (txDb) => {
    await txDb.run(
      "UPDATE key_rate_limits SET name = $1, response_code = $2, response_body = $3, response_type = $4 WHERE id = $5",
      [name, response_code, response_body, response_type, id],
    );

    // Replace rules atomically
    await txDb.run("DELETE FROM rate_limit_rules WHERE rate_limit_id = $1", [id]);
    for (const rule of rules || []) {
      await txDb.run(
        "INSERT INTO rate_limit_rules (rate_limit_id, requests, window_seconds) VALUES ($1, $2, $3)",
        [id, rule.requests, rule.window_seconds],
      );
    }
  });

  res.json({
    id,
    name,
    rules,
    response_code,
    response_body,
    response_type,
  });
}

// ── GET /rate-limits/:id/associated-presets ──────────────────────────
export async function getAssociatedPresets(req, res) {
  const db = getDb();
  const { id } = req.params;

  const associatedPresets = await db.all(
    `SELECT p.id, p.name FROM presets p WHERE p.rate_limit_id = $1`,
    [id],
  );

  res.json({ associated_presets: associatedPresets });
}

// ── DELETE /rate-limits/:id ───────────────────────────────────────────
export async function remove(req, res) {
  const db = getDb();
  const { id } = req.params;

  const rateLimit = await db.get(
    "SELECT id FROM key_rate_limits WHERE id = $1",
    [id],
  );
  if (!rateLimit) {
    throw AppError.notFound("Rate limit not found");
  }

  const associatedPresets = await db.all(
    `SELECT p.id, p.name FROM presets p WHERE p.rate_limit_id = $1`,
    [id],
  );

  if (associatedPresets.length > 0) {
    throw AppError.badRequest(
      `Cannot delete rate limit: ${associatedPresets.length} preset(s) are using it.`,
    );
  }

  await db.run("DELETE FROM key_rate_limits WHERE id = $1", [id]);
  res.json({ success: true });
}
