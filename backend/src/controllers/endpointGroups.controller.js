import { getDb } from "../db/index.js";
import { AppError } from "../errors/AppError.js";
import { propagateQuotasForPreset } from "../services/quota-sync.js";

// ── POST /resources/:resourceId/endpoint-groups ──────────────────────
export async function create(req, res) {
  const db = getDb();
  const { resourceId } = req.params;
  const { name, description, endpoints } = req.body;

  // Verify resource exists
  const resource = await db.get(
    "SELECT id FROM resources WHERE id = $1",
    [resourceId],
  );
  if (!resource) {
    throw AppError.notFound("Resource not found");
  }

  // Check for duplicate name in same resource
  const existing = await db.get(
    "SELECT id FROM endpoint_groups WHERE resource_id = $1 AND name = $2",
    [resourceId, name],
  );
  if (existing) {
    throw AppError.badRequest(
      "Endpoint group name must be unique within this resource",
    );
  }

  const result = await db.run(
    "INSERT INTO endpoint_groups (resource_id, name, description) VALUES ($1, $2, $3) RETURNING id",
    [resourceId, name, description || null],
  );
  const groupId = result.insertedId;

  for (const endpoint of endpoints || []) {
    await db.run(
      "INSERT INTO endpoints (endpoint_group_id, url_pattern, method) VALUES ($1, $2, $3)",
      [groupId, endpoint.url_pattern, endpoint.method],
    );
  }

  res.status(201).json({
    id: groupId,
    name,
    description: description || null,
    endpoints,
  });
}

// ── PUT /endpoint-groups/:id ──────────────────────────────────────────
export async function update(req, res) {
  const db = getDb();
  const { id } = req.params;
  const { name, description, endpoints } = req.body;

  // Verify endpoint group exists
  const group = await db.get(
    `SELECT eg.resource_id FROM endpoint_groups eg
     WHERE eg.id = $1`,
    [id],
  );
  if (!group) {
    throw AppError.notFound("Endpoint group not found");
  }

  // Check for duplicate name in same resource (excluding current)
  const existing = await db.get(
    "SELECT id FROM endpoint_groups WHERE resource_id = $1 AND name = $2 AND id != $3",
    [group.resource_id, name, id],
  );
  if (existing) {
    throw AppError.badRequest(
      "Endpoint group name must be unique within this resource",
    );
  }

  await db.run(
    "UPDATE endpoint_groups SET name = $1, description = $2 WHERE id = $3",
    [name, description || null, id],
  );

  // Replace endpoints
  await db.run("DELETE FROM endpoints WHERE endpoint_group_id = $1", [id]);
  for (const endpoint of endpoints || []) {
    await db.run(
      "INSERT INTO endpoints (endpoint_group_id, url_pattern, method) VALUES ($1, $2, $3)",
      [id, endpoint.url_pattern, endpoint.method],
    );
  }

  res.json({ id, name, description: description || null, endpoints });
}

// ── GET /endpoint-groups/:id/associated-presets ───────────────────────
export async function getAssociatedKeys(req, res) {
  const db = getDb();
  const { id } = req.params;

  // Verify endpoint group exists
  const group = await db.get(
    `SELECT eg.id FROM endpoint_groups eg
     WHERE eg.id = $1`,
    [id],
  );
  if (!group) {
    throw AppError.notFound("Endpoint group not found");
  }

  const associatedPresets = await db.all(
    `SELECT pr.id, pr.name
     FROM presets pr
     INNER JOIN preset_endpoint_groups peg ON pr.id = peg.preset_id
     WHERE peg.endpoint_group_id = $1`,
    [id],
  );

  res.json({ associated_presets: associatedPresets });
}

// ── DELETE /endpoint-groups/:id ───────────────────────────────────────
export async function remove(req, res) {
  const db = getDb();
  const { id } = req.params;
  const force = req.query.force === "true";

  // Verify endpoint group exists
  const group = await db.get(
    `SELECT eg.id FROM endpoint_groups eg
     WHERE eg.id = $1`,
    [id],
  );
  if (!group) {
    throw AppError.notFound("Endpoint group not found");
  }

  // Check for associated presets
  const associatedPresets = await db.all(
    `SELECT pr.id, pr.name
     FROM presets pr
     INNER JOIN preset_endpoint_groups peg ON pr.id = peg.preset_id
     WHERE peg.endpoint_group_id = $1`,
    [id],
  );

  // If presets reference this group and force is not set, ask for confirmation
  if (associatedPresets.length > 0 && !force) {
    return res.json({
      confirm_required: true,
      associated_preset_count: associatedPresets.length,
      associated_presets: associatedPresets,
    });
  }

  // If presets reference this group, cascade-remove join rows and re-propagate quotas
  if (associatedPresets.length > 0) {
    // Remove join rows
    await db.run(
      "DELETE FROM preset_endpoint_groups WHERE endpoint_group_id = $1",
      [id],
    );

    // Re-propagate quotas for each affected preset
    for (const preset of associatedPresets) {
      const groups = await db.all(
        "SELECT endpoint_group_id, lease_seconds, usage_limit FROM preset_endpoint_groups WHERE preset_id = $1",
        [preset.id],
      );
      await propagateQuotasForPreset(preset.id, groups);
    }
  }

  await db.run("DELETE FROM endpoint_groups WHERE id = $1", [id]);
  res.json({ success: true });
}
