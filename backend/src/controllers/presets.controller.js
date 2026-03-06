import { getDb } from "../db/index.js";
import { AppError } from "../errors/AppError.js";
import {
  propagateQuotasForPreset,
  initQuotasForApiKey,
} from "../services/quota-sync.js";

// ── Helpers ───────────────────────────────────────────────────────────

/**
 * Enrich a preset row with related data (endpoint groups, resources, counts).
 */
async function enrichPreset(db, preset) {
  // Endpoint groups (with per-group lease & usage settings)
  preset.endpoint_groups = await db.all(
    `SELECT eg.id, eg.name, eg.description, eg.resource_id, r.name AS resource_name,
            peg.lease_seconds, peg.usage_limit
     FROM preset_endpoint_groups peg
     JOIN endpoint_groups eg ON eg.id = peg.endpoint_group_id
     LEFT JOIN resources r ON eg.resource_id = r.id
     WHERE peg.preset_id = $1
     ORDER BY eg.name`,
    [preset.id],
  );

  // Enrich each endpoint group with its endpoints
  for (const group of preset.endpoint_groups) {
    group.endpoints = await db.all(
      `SELECT id, method, url_pattern FROM endpoints WHERE endpoint_group_id = $1 ORDER BY method, url_pattern`,
      [group.id],
    );
  }

  // Resources (include unique_path, external_api_base_url, and per-resource quotas)
  preset.resources = await db.all(
    `SELECT r.id, r.name, r.unique_path, r.external_api_url AS external_api_base_url,
            pr.usage_limit, pr.lease_seconds
     FROM preset_resources pr
     JOIN resources r ON r.id = pr.resource_id
     WHERE pr.preset_id = $1
     ORDER BY r.name`,
    [preset.id],
  );

  // API key count
  const apiKeyCount = await db.get(
    "SELECT COUNT(*) AS count FROM api_keys WHERE preset_id = $1",
    [preset.id],
  );
  preset.api_key_count = apiKeyCount.count;

  // Rate limit name + rules
  if (preset.rate_limit_id) {
    const rl = await db.get("SELECT name FROM key_rate_limits WHERE id = $1", [
      preset.rate_limit_id,
    ]);
    preset.rate_limit_name = rl?.name || null;
    preset.rate_limit_rules = await db.all(
      "SELECT requests, window_seconds FROM rate_limit_rules WHERE rate_limit_id = $1 ORDER BY window_seconds",
      [preset.rate_limit_id],
    );
  } else {
    preset.rate_limit_name = null;
    preset.rate_limit_rules = [];
  }

  // IP allowlist name
  if (preset.ip_allowlist_id) {
    const al = await db.get("SELECT name FROM ip_allowlists WHERE id = $1", [
      preset.ip_allowlist_id,
    ]);
    preset.ip_allowlist_name = al?.name || null;
  } else {
    preset.ip_allowlist_name = null;
  }

  // IP blocklist name
  if (preset.ip_blocklist_id) {
    const bl = await db.get("SELECT name FROM ip_blocklists WHERE id = $1", [
      preset.ip_blocklist_id,
    ]);
    preset.ip_blocklist_name = bl?.name || null;
  } else {
    preset.ip_blocklist_name = null;
  }

  // Parse allowed_methods CSV into array for client
  preset.allowed_methods = preset.allowed_methods
    ? preset.allowed_methods
        .split(",")
        .map((m) => m.trim())
        .filter(Boolean)
    : ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"];

  return preset;
}

/**
 * Sync a preset's many-to-many relations (endpoint groups, resources).
 * @param {object}  db
 * @param {number}  presetId
 * @param {number[]} endpointGroupIds
 * @param {number[]} resourceIds
 * @param {Record<string, {usage_limit?: number|null, lease_seconds?: number|null}>} [endpointGroupSettings={}]
 * @param {Record<string, {usage_limit?: number|null, lease_seconds?: number|null}>} [resourceSettings={}]
 */
async function syncRelations(
  db,
  presetId,
  endpointGroupIds,
  resourceIds,
  endpointGroupSettings = {},
  resourceSettings = {},
) {
  // Only sync endpoint groups if explicitly provided (undefined means "don't touch")
  if (endpointGroupIds !== undefined) {
    await db.run("DELETE FROM preset_endpoint_groups WHERE preset_id = $1", [
      presetId,
    ]);
    for (const egId of endpointGroupIds || []) {
      const settings = endpointGroupSettings[String(egId)] || {};
      await db.run(
        `INSERT INTO preset_endpoint_groups (preset_id, endpoint_group_id, lease_seconds, usage_limit)
         VALUES ($1, $2, $3, $4)`,
        [
          presetId,
          egId,
          settings.lease_seconds || null,
          settings.usage_limit || null,
        ],
      );
    }
  }

  // Only sync resources if explicitly provided (undefined means "don't touch")
  if (resourceIds !== undefined) {
    await db.run("DELETE FROM preset_resources WHERE preset_id = $1", [
      presetId,
    ]);
    for (const rId of resourceIds || []) {
      const rSettings = resourceSettings[String(rId)] || {};
      await db.run(
        "INSERT INTO preset_resources (preset_id, resource_id, usage_limit, lease_seconds) VALUES ($1, $2, $3, $4)",
        [
          presetId,
          rId,
          rSettings.usage_limit || null,
          rSettings.lease_seconds || null,
        ],
      );
    }
  }
}

// ── GET /presets ──────────────────────────────────────────────────────
export async function list(req, res) {
  const db = getDb();
  const presets = await db.all("SELECT * FROM presets ORDER BY name ASC");

  await Promise.all(presets.map((preset) => enrichPreset(db, preset)));

  res.json(presets);
}

// ── GET /presets/:id ─────────────────────────────────────────────────
export async function get(req, res) {
  const db = getDb();
  const { id } = req.params;

  const preset = await db.get("SELECT * FROM presets WHERE id = $1", [id]);
  if (!preset) {
    throw AppError.notFound("Preset not found");
  }

  await enrichPreset(db, preset);
  res.json(preset);
}

// ── POST /presets ────────────────────────────────────────────────────
export async function create(req, res) {
  const db = getDb();
  const {
    name,
    description,
    is_full_access,
    rate_limit_id,
    ip_allowlist_id,
    ip_blocklist_id,
    endpoint_group_ids,
    resource_ids,
    endpoint_group_settings,
    resource_settings,
    allowed_methods,
  } = req.body;

  // Check name uniqueness
  const existing = await db.get("SELECT id FROM presets WHERE name = $1", [
    name,
  ]);
  if (existing) {
    throw AppError.conflict("Preset name already exists");
  }

  // Validate FK references if provided
  if (rate_limit_id) {
    const rl = await db.get("SELECT id FROM key_rate_limits WHERE id = $1", [
      rate_limit_id,
    ]);
    if (!rl) throw AppError.badRequest("Rate limit not found");
  }
  if (ip_allowlist_id) {
    const al = await db.get("SELECT id FROM ip_allowlists WHERE id = $1", [
      ip_allowlist_id,
    ]);
    if (!al) throw AppError.badRequest("IP allowlist not found");
  }
  if (ip_blocklist_id) {
    const bl = await db.get("SELECT id FROM ip_blocklists WHERE id = $1", [
      ip_blocklist_id,
    ]);
    if (!bl) throw AppError.badRequest("IP blocklist not found");
  }

  const allowedMethodsCsv = allowed_methods
    ? allowed_methods.join(",")
    : "GET,POST,PUT,PATCH,DELETE,HEAD";

  const result = await db.run(
    `INSERT INTO presets (name, description, is_full_access, rate_limit_id, ip_allowlist_id, ip_blocklist_id, allowed_methods)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [
      name,
      description || null,
      is_full_access || false,
      rate_limit_id || null,
      ip_allowlist_id || null,
      ip_blocklist_id || null,
      allowedMethodsCsv,
    ],
  );

  // Only sync relations for non-full-access presets
  if (!is_full_access) {
    await syncRelations(
      db,
      result.insertedId,
      endpoint_group_ids,
      resource_ids,
      endpoint_group_settings || {},
      resource_settings || {},
    );

    // Propagate quotas to any API keys already on this preset
    const resources = await db.all(
      "SELECT resource_id, lease_seconds, usage_limit FROM preset_resources WHERE preset_id = $1",
      [result.insertedId],
    );
    await propagateQuotasForPreset(result.insertedId, resources);
  }

  const preset = await db.get("SELECT * FROM presets WHERE id = $1", [
    result.insertedId,
  ]);
  await enrichPreset(db, preset);
  res.status(201).json(preset);
}

// ── PUT /presets/:id ─────────────────────────────────────────────────
export async function update(req, res) {
  const db = getDb();
  const { id } = req.params;
  const {
    name,
    description,
    is_full_access,
    rate_limit_id,
    ip_allowlist_id,
    ip_blocklist_id,
    endpoint_group_ids,
    resource_ids,
    endpoint_group_settings,
    resource_settings,
    allowed_methods,
  } = req.body;

  const preset = await db.get("SELECT * FROM presets WHERE id = $1", [id]);
  if (!preset) {
    throw AppError.notFound("Preset not found");
  }

  // Guard: system presets cannot be modified
  if (preset.is_system) {
    throw AppError.forbidden("System presets cannot be modified");
  }

  // Check name uniqueness (exclude self)
  if (name) {
    const dup = await db.get(
      "SELECT id FROM presets WHERE name = $1 AND id != $2",
      [name, id],
    );
    if (dup) {
      throw AppError.conflict("Preset name already exists");
    }
  }

  const allowedMethodsCsv = allowed_methods
    ? allowed_methods.join(",")
    : undefined;

  await db.run(
    `UPDATE presets
     SET name = COALESCE($1, name),
         description = $2,
         is_full_access = COALESCE($3, is_full_access),
         rate_limit_id = $4,
         ip_allowlist_id = $5,
         ip_blocklist_id = $6,
         allowed_methods = COALESCE($7, allowed_methods),
         updated_at = NOW()
     WHERE id = $8`,
    [
      name || preset.name,
      description !== undefined ? description : preset.description,
      is_full_access !== undefined ? is_full_access : preset.is_full_access,
      rate_limit_id !== undefined ? rate_limit_id : preset.rate_limit_id,
      ip_allowlist_id !== undefined ? ip_allowlist_id : preset.ip_allowlist_id,
      ip_blocklist_id !== undefined ? ip_blocklist_id : preset.ip_blocklist_id,
      allowedMethodsCsv !== undefined ? allowedMethodsCsv : preset.allowed_methods,
      id,
    ],
  );

  if (endpoint_group_ids !== undefined || resource_ids !== undefined) {
    await syncRelations(
      db,
      id,
      endpoint_group_ids !== undefined ? endpoint_group_ids : undefined,
      resource_ids !== undefined ? resource_ids : undefined,
      endpoint_group_settings || {},
      resource_settings || {},
    );

    // Propagate quota changes to all affected API keys (per-resource)
    const resourceQuotas = await db.all(
      "SELECT resource_id, lease_seconds, usage_limit FROM preset_resources WHERE preset_id = $1",
      [id],
    );
    await propagateQuotasForPreset(id, resourceQuotas);
  }

  const updated = await db.get("SELECT * FROM presets WHERE id = $1", [id]);
  await enrichPreset(db, updated);
  res.json(updated);
}

// ── POST /presets/:id/duplicate ──────────────────────────────────────
export async function duplicate(req, res) {
  const db = getDb();
  const { id } = req.params;

  const source = await db.get("SELECT * FROM presets WHERE id = $1", [id]);
  if (!source) {
    throw AppError.notFound("Preset not found");
  }

  // Generate unique copy name
  let copyName = `${source.name} (Copy)`;
  let counter = 1;
  while (await db.get("SELECT id FROM presets WHERE name = $1", [copyName])) {
    counter++;
    copyName = `${source.name} (Copy ${counter})`;
  }

  const result = await db.run(
    `INSERT INTO presets (name, description, is_full_access, rate_limit_id, ip_allowlist_id, ip_blocklist_id, allowed_methods)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [
      copyName,
      source.description,
      source.is_full_access,
      source.rate_limit_id,
      source.ip_allowlist_id,
      source.ip_blocklist_id,
      source.allowed_methods,
    ],
  );
  const newId = result.insertedId;

  // Copy endpoint group mappings (preserve lease/usage settings)
  const egs = await db.all(
    "SELECT endpoint_group_id, lease_seconds, usage_limit FROM preset_endpoint_groups WHERE preset_id = $1",
    [id],
  );
  for (const eg of egs) {
    await db.run(
      `INSERT INTO preset_endpoint_groups (preset_id, endpoint_group_id, lease_seconds, usage_limit)
       VALUES ($1, $2, $3, $4)`,
      [newId, eg.endpoint_group_id, eg.lease_seconds, eg.usage_limit],
    );
  }

  // Copy resource mappings (preserve per-resource quota settings)
  const rsrcs = await db.all(
    "SELECT resource_id, usage_limit, lease_seconds FROM preset_resources WHERE preset_id = $1",
    [id],
  );
  for (const r of rsrcs) {
    await db.run(
      "INSERT INTO preset_resources (preset_id, resource_id, usage_limit, lease_seconds) VALUES ($1, $2, $3, $4)",
      [newId, r.resource_id, r.usage_limit, r.lease_seconds],
    );
  }

  const newPreset = await db.get("SELECT * FROM presets WHERE id = $1", [
    newId,
  ]);
  await enrichPreset(db, newPreset);
  res.status(201).json(newPreset);
}

// ── DELETE /presets/:id ──────────────────────────────────────────────
export async function remove(req, res) {
  const db = getDb();
  const { id } = req.params;
  const reassignPresetId = req.query.reassign_preset_id
    ? parseInt(req.query.reassign_preset_id)
    : null;

  const preset = await db.get("SELECT * FROM presets WHERE id = $1", [id]);
  if (!preset) {
    throw AppError.notFound("Preset not found");
  }

  // Guard: system presets cannot be deleted
  if (preset.is_system) {
    throw AppError.forbidden("System presets cannot be deleted");
  }

  const apiKeyCount = await db.get(
    "SELECT COUNT(*) AS count FROM api_keys WHERE preset_id = $1",
    [id],
  );

  const hasEntities = apiKeyCount.count > 0;

  // If API keys are assigned but no reassignment target provided, return 409
  if (hasEntities && !reassignPresetId) {
    return res.status(409).json({
      error: `Cannot delete preset: it has ${apiKeyCount.count} API key(s) assigned. Choose a preset to reassign them to.`,
      api_key_count: parseInt(apiKeyCount.count),
    });
  }

  // Reassign API keys if a target preset was specified
  if (hasEntities && reassignPresetId) {
    if (reassignPresetId === parseInt(id)) {
      throw AppError.badRequest(
        "Cannot reassign to the same preset being deleted.",
      );
    }

    const targetPreset = await db.get("SELECT id FROM presets WHERE id = $1", [
      reassignPresetId,
    ]);
    if (!targetPreset) {
      throw AppError.badRequest("Target reassignment preset not found.");
    }

    // Reassign API keys
    const affectedKeys = await db.all(
      "SELECT id FROM api_keys WHERE preset_id = $1",
      [id],
    );
    await db.run("UPDATE api_keys SET preset_id = $1 WHERE preset_id = $2", [
      reassignPresetId,
      id,
    ]);
    // Sync quotas for each reassigned API key
    for (const ak of affectedKeys) {
      await initQuotasForApiKey(ak.id, reassignPresetId);
    }
  }

  await db.run("DELETE FROM presets WHERE id = $1", [id]);
  res.json({ success: true });
}

// ── POST /presets/batch-update ───────────────────────────────────────
export async function batchUpdate(req, res) {
  const db = getDb();
  const {
    preset_ids,
    resource_ids,
    endpoint_group_ids,
    endpoint_group_settings,
    operation = "add",
  } = req.body;

  // Edge case: nothing to process
  if (
    (!resource_ids || resource_ids.length === 0) &&
    (!endpoint_group_ids || endpoint_group_ids.length === 0)
  ) {
    throw AppError.badRequest(
      "At least one resource or endpoint group must be selected",
    );
  }

  // Validate all referenced presets exist and none are system presets
  for (const presetId of preset_ids) {
    const preset = await db.get(
      "SELECT id, is_system FROM presets WHERE id = $1",
      [presetId],
    );
    if (!preset) {
      throw AppError.notFound(`Preset with id ${presetId} not found`);
    }
    if (preset.is_system) {
      throw AppError.forbidden("Cannot batch-update system presets");
    }
  }

  // For "add" operations, validate FK references exist
  if (operation === "add") {
    for (const rId of resource_ids || []) {
      const resource = await db.get("SELECT id FROM resources WHERE id = $1", [
        rId,
      ]);
      if (!resource) {
        throw AppError.badRequest(`Resource with id ${rId} not found`);
      }
    }

    for (const egId of endpoint_group_ids || []) {
      const group = await db.get(
        "SELECT id FROM endpoint_groups WHERE id = $1",
        [egId],
      );
      if (!group) {
        throw AppError.badRequest(`Endpoint group with id ${egId} not found`);
      }
    }
  }

  let updatedCount = 0;

  for (const presetId of preset_ids) {
    if (operation === "remove") {
      // Remove resources from preset
      for (const rId of resource_ids || []) {
        await db.run(
          "DELETE FROM preset_resources WHERE preset_id = $1 AND resource_id = $2",
          [presetId, rId],
        );
      }

      // Remove endpoint groups from preset
      for (const egId of endpoint_group_ids || []) {
        await db.run(
          "DELETE FROM preset_endpoint_groups WHERE preset_id = $1 AND endpoint_group_id = $2",
          [presetId, egId],
        );
      }
    } else {
      // Additively merge resources (skip duplicates)
      for (const rId of resource_ids || []) {
        await db.run(
          `INSERT INTO preset_resources (preset_id, resource_id)
           VALUES ($1, $2)
           ON CONFLICT (preset_id, resource_id) DO NOTHING`,
          [presetId, rId],
        );
      }

      // Additively merge endpoint groups (skip duplicates, apply settings for new ones)
      for (const egId of endpoint_group_ids || []) {
        const settings = (endpoint_group_settings || {})[String(egId)] || {};
        await db.run(
          `INSERT INTO preset_endpoint_groups (preset_id, endpoint_group_id, lease_seconds, usage_limit)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (preset_id, endpoint_group_id) DO NOTHING`,
          [
            presetId,
            egId,
            settings.lease_seconds || null,
            settings.usage_limit || null,
          ],
        );
      }
    }

    // Propagate quotas for the updated preset (full groups list)
    const groups = await db.all(
      "SELECT endpoint_group_id, lease_seconds, usage_limit FROM preset_endpoint_groups WHERE preset_id = $1",
      [presetId],
    );
    await propagateQuotasForPreset(presetId, groups);

    updatedCount++;
  }

  res.json({ success: true, updated_count: updatedCount });
}
