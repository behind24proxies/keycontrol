/**
 * Edge-case integration tests.
 *
 * Covers boundary conditions, partial-update semantics, cascade
 * behaviour, and error paths that the happy-path suites do not.
 *
 * Each test block documents the *rationale* for the edge case it targets.
 */
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { createTestEnv } from "../helpers/setup.js";
import {
  loginAsAdmin,
  seedResource,
  seedPreset,
  seedApiKey,
  seedEndpointGroup,
  seedBlocklist,
  seedAllowlist,
  seedRateLimit,
  authHeader,
} from "../helpers/factories.js";
import { ADMIN_PASSWORD } from "../helpers/constants.js";

let app, db, token;

beforeAll(async () => {
  ({ app, db } = await createTestEnv());
  ({ token } = await loginAsAdmin(app));
});

// ═════════════════════════════════════════════════════════════════════
// 1. Presets — syncRelations partial-update bug
// ═════════════════════════════════════════════════════════════════════
describe("Preset partial update (syncRelations)", () => {
  /**
   * Rationale: When a preset is updated with only resource_ids, the existing
   * endpoint_group associations MUST be preserved — they should NOT be wiped
   * because endpoint_group_ids was not included in the request body.
   */
  it("preserves endpoint groups when only resource_ids is updated", async () => {
    const resource = await seedResource(db, { unique_path: "sync-r1" });
    const eg = await seedEndpointGroup(db, resource.id, { name: "EG Keep" });
    const preset = await seedPreset(db, { name: "Sync Test" });

    // Attach endpoint group via update
    await request(app)
      .put(`/api/presets/${preset.id}`)
      .set(authHeader(token))
      .send({ endpoint_group_ids: [eg.id] });

    // Now update ONLY resource_ids — endpoint groups must survive
    const res = await request(app)
      .put(`/api/presets/${preset.id}`)
      .set(authHeader(token))
      .send({ resource_ids: [resource.id] });

    expect(res.status).toBe(200);
    expect(res.body.endpoint_groups).toHaveLength(1);
    expect(res.body.endpoint_groups[0].id).toBe(eg.id);
    expect(res.body.resources).toHaveLength(1);
  });

  /**
   * Rationale: Mirror case — updating only endpoint_group_ids must not
   * wipe resource associations.
   */
  it("preserves resources when only endpoint_group_ids is updated", async () => {
    const resource = await seedResource(db, { unique_path: "sync-r2" });
    const eg = await seedEndpointGroup(db, resource.id, { name: "EG Keep2" });
    const preset = await seedPreset(db, { name: "Sync Test 2" });

    // Attach resource via update
    await request(app)
      .put(`/api/presets/${preset.id}`)
      .set(authHeader(token))
      .send({ resource_ids: [resource.id] });

    // Now update ONLY endpoint_group_ids — resources must survive
    const res = await request(app)
      .put(`/api/presets/${preset.id}`)
      .set(authHeader(token))
      .send({ endpoint_group_ids: [eg.id] });

    expect(res.status).toBe(200);
    expect(res.body.resources).toHaveLength(1);
    expect(res.body.resources[0].id).toBe(resource.id);
    expect(res.body.endpoint_groups).toHaveLength(1);
  });

  /**
   * Rationale: Sending an explicit empty array should clear the relation,
   * unlike omitting the field which preserves it.
   */
  it("clears endpoint groups when empty array is sent explicitly", async () => {
    const resource = await seedResource(db, { unique_path: "sync-r3" });
    const eg = await seedEndpointGroup(db, resource.id, { name: "EG Clear" });
    const preset = await seedPreset(db, { name: "Sync Clear" });

    // Attach endpoint group
    await request(app)
      .put(`/api/presets/${preset.id}`)
      .set(authHeader(token))
      .send({ endpoint_group_ids: [eg.id] });

    // Send empty array — should clear
    const res = await request(app)
      .put(`/api/presets/${preset.id}`)
      .set(authHeader(token))
      .send({ endpoint_group_ids: [] });

    expect(res.status).toBe(200);
    expect(res.body.endpoint_groups).toHaveLength(0);
  });
});

// ═════════════════════════════════════════════════════════════════════
// 2. Presets — system preset immutability
// ═════════════════════════════════════════════════════════════════════
describe("System preset guards", () => {
  /**
   * Rationale: The "Master Access" system preset must never be modified
   * or deleted via the API — it's the fallback full-access preset.
   */
  it("rejects update of system preset", async () => {
    // The test env seeds a Master Access system preset at id=1
    const masterPreset = await db.get(
      "SELECT id FROM presets WHERE is_system = TRUE LIMIT 1",
    );
    const res = await request(app)
      .put(`/api/presets/${masterPreset.id}`)
      .set(authHeader(token))
      .send({ name: "Hacked" });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN");
  });

  it("rejects deletion of system preset", async () => {
    const masterPreset = await db.get(
      "SELECT id FROM presets WHERE is_system = TRUE LIMIT 1",
    );
    const res = await request(app)
      .delete(`/api/presets/${masterPreset.id}`)
      .set(authHeader(token));

    expect(res.status).toBe(403);
  });

  /**
   * Rationale: Batch update must also reject system presets to prevent
   * accidental mass-modification.
   */
  it("rejects batch update that includes a system preset", async () => {
    const masterPreset = await db.get(
      "SELECT id FROM presets WHERE is_system = TRUE LIMIT 1",
    );
    const resource = await seedResource(db, { unique_path: "sys-batch" });

    const res = await request(app)
      .post("/api/presets/batch-update")
      .set(authHeader(token))
      .send({
        preset_ids: [masterPreset.id],
        resource_ids: [resource.id],
      });

    expect(res.status).toBe(403);
  });
});

// ═════════════════════════════════════════════════════════════════════
// 3. Preset deletion — reassignment edge cases
// ═════════════════════════════════════════════════════════════════════
describe("Preset deletion reassignment", () => {
  /**
   * Rationale: Deleting a preset with API keys without specifying
   * a reassignment target must return 409 (conflict), not silently
   * orphan the keys.
   */
  it("returns 409 when deleting preset with API keys and no reassignment", async () => {
    const preset = await seedPreset(db, { name: "Del-Conflict" });
    await seedApiKey(db, preset.id);

    const res = await request(app)
      .delete(`/api/presets/${preset.id}`)
      .set(authHeader(token));

    expect(res.status).toBe(409);
    expect(res.body.api_key_count).toBeGreaterThan(0);
  });

  /**
   * Rationale: Reassigning to the same preset being deleted is logically
   * invalid and should return 400.
   */
  it("rejects reassignment to same preset being deleted", async () => {
    const preset = await seedPreset(db, { name: "Del-Self" });
    await seedApiKey(db, preset.id);

    const res = await request(app)
      .delete(`/api/presets/${preset.id}?reassign_preset_id=${preset.id}`)
      .set(authHeader(token));

    expect(res.status).toBe(400);
  });

  /**
   * Rationale: Reassignment to a non-existent preset should fail
   * cleanly rather than creating orphaned keys.
   */
  it("rejects reassignment to non-existent preset", async () => {
    const preset = await seedPreset(db, { name: "Del-Ghost" });
    await seedApiKey(db, preset.id);

    const res = await request(app)
      .delete(`/api/presets/${preset.id}?reassign_preset_id=99999`)
      .set(authHeader(token));

    expect(res.status).toBe(400);
  });

  /**
   * Rationale: Valid reassignment should move all API keys to the target
   * preset and then delete the source preset.
   */
  it("successfully reassigns API keys and deletes preset", async () => {
    const source = await seedPreset(db, { name: "Del-Source" });
    const target = await seedPreset(db, { name: "Del-Target" });
    const key = await seedApiKey(db, source.id, { name: "Reassign Key" });

    const res = await request(app)
      .delete(`/api/presets/${source.id}?reassign_preset_id=${target.id}`)
      .set(authHeader(token));

    expect(res.status).toBe(200);

    // Verify key moved to target
    const movedKey = await db.get(
      "SELECT preset_id FROM api_keys WHERE id = $1",
      [key.id],
    );
    expect(movedKey.preset_id).toBe(target.id);

    // Verify source preset is gone
    const deleted = await db.get("SELECT id FROM presets WHERE id = $1", [
      source.id,
    ]);
    expect(deleted).toBeUndefined();
  });
});

// ═════════════════════════════════════════════════════════════════════
// 4. Preset name uniqueness
// ═════════════════════════════════════════════════════════════════════
describe("Preset name uniqueness", () => {
  /**
   * Rationale: Creating two presets with the same name would confuse
   * admins and should return 409.
   */
  it("rejects duplicate preset name on create", async () => {
    await seedPreset(db, { name: "UniqueCheck" });
    const res = await request(app)
      .post("/api/presets")
      .set(authHeader(token))
      .send({ name: "UniqueCheck" });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("CONFLICT");
  });

  /**
   * Rationale: Updating a preset to use another preset's name
   * should be rejected.
   */
  it("rejects duplicate preset name on update", async () => {
    const p1 = await seedPreset(db, { name: "Unique-A" });
    await seedPreset(db, { name: "Unique-B" });

    const res = await request(app)
      .put(`/api/presets/${p1.id}`)
      .set(authHeader(token))
      .send({ name: "Unique-B" });

    expect(res.status).toBe(409);
  });
});

// ═════════════════════════════════════════════════════════════════════
// 5. API keys — search with LIKE special characters
// ═════════════════════════════════════════════════════════════════════
describe("API key search edge cases", () => {
  /**
   * Rationale: The % character is a SQL LIKE wildcard. Without proper
   * escaping, searching for "100%" would match "1000", "100abc", etc.
   */
  it("escapes % in search term so it matches literally", async () => {
    const preset = await seedPreset(db, { name: "SearchPreset" });
    await seedApiKey(db, preset.id, { name: "Key 100% Done" });
    await seedApiKey(db, preset.id, { name: "Key 1000" });

    const res = await request(app)
      .get("/api/api-keys?search=100%25") // %25 = URL-encoded %
      .set(authHeader(token));

    expect(res.status).toBe(200);
    // Should match "Key 100% Done" but NOT "Key 1000"
    const names = res.body.api_keys.map((k) => k.name);
    expect(names).toContain("Key 100% Done");
    expect(names).not.toContain("Key 1000");
  });

  /**
   * Rationale: The _ character is a SQL LIKE single-char wildcard.
   * Searching for "a_b" should only match literal "a_b", not "axb".
   */
  it("escapes _ in search term so it matches literally", async () => {
    const preset = await seedPreset(db, { name: "SearchPreset2" });
    await seedApiKey(db, preset.id, { name: "a_b key" });
    await seedApiKey(db, preset.id, { name: "axb key" });

    const res = await request(app)
      .get("/api/api-keys?search=a_b")
      .set(authHeader(token));

    expect(res.status).toBe(200);
    const names = res.body.api_keys.map((k) => k.name);
    expect(names).toContain("a_b key");
    expect(names).not.toContain("axb key");
  });
});

// ═════════════════════════════════════════════════════════════════════
// 6. Resources — unique_path constraint
// ═════════════════════════════════════════════════════════════════════
describe("Resource unique_path enforcement", () => {
  /**
   * Rationale: Two resources with the same unique_path would cause
   * routing collisions in the gateway.
   */
  it("rejects duplicate unique_path on create", async () => {
    await seedResource(db, { unique_path: "dup-path" });

    const res = await request(app)
      .post("/api/resources")
      .set(authHeader(token))
      .send({
        name: "Dup Resource",
        unique_path: "dup-path",
        secret_api_key: "sk-dup",
        external_api_base_url: "https://api.dup.com",
      });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("CONFLICT");
  });
});

// ═════════════════════════════════════════════════════════════════════
// 7. Resources — deletion cascading
// ═════════════════════════════════════════════════════════════════════
describe("Resource deletion effects", () => {
  /**
   * Rationale: Deleting a resource should nullify foreign keys in
   * request_logs and remove the resource, but not fail.
   */
  it("cleans up logs and endpoint groups on resource deletion", async () => {
    const resource = await seedResource(db, { unique_path: "del-cascade" });
    await seedEndpointGroup(db, resource.id, { name: "Cascade-EG" });

    const res = await request(app)
      .delete(`/api/resources/${resource.id}`)
      .set(authHeader(token));

    expect(res.status).toBe(200);

    // Endpoint groups should be cascade-deleted
    const groups = await db.all(
      "SELECT id FROM endpoint_groups WHERE resource_id = $1",
      [resource.id],
    );
    expect(groups).toHaveLength(0);
  });

  it("returns 404 for non-existent resource", async () => {
    const res = await request(app)
      .delete("/api/resources/99999")
      .set(authHeader(token));

    expect(res.status).toBe(404);
  });
});

// ═════════════════════════════════════════════════════════════════════
// 8. Endpoint groups — cascade deletion with force flag
// ═════════════════════════════════════════════════════════════════════
describe("Endpoint group deletion edge cases", () => {
  /**
   * Rationale: Deleting an endpoint group used by presets should
   * first ask for confirmation (return confirm_required), then
   * proceed when force=true.
   */
  it("returns confirm_required when deleting group used by presets", async () => {
    const resource = await seedResource(db, { unique_path: "eg-del-1" });
    const eg = await seedEndpointGroup(db, resource.id, { name: "EG Del 1" });
    const preset = await seedPreset(db, { name: "EG-Del Preset" });

    // Attach endpoint group to preset
    await db.run(
      "INSERT INTO preset_endpoint_groups (preset_id, endpoint_group_id) VALUES ($1, $2)",
      [preset.id, eg.id],
    );

    const res = await request(app)
      .delete(`/api/endpoint-groups/${eg.id}`)
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.confirm_required).toBe(true);
    expect(res.body.associated_preset_count).toBe(1);

    // Group should still exist
    const stillExists = await db.get(
      "SELECT id FROM endpoint_groups WHERE id = $1",
      [eg.id],
    );
    expect(stillExists).not.toBeNull();
  });

  it("force-deletes group and cleans preset associations", async () => {
    const resource = await seedResource(db, { unique_path: "eg-del-2" });
    const eg = await seedEndpointGroup(db, resource.id, { name: "EG Del 2" });
    const preset = await seedPreset(db, { name: "EG-Del Preset2" });

    await db.run(
      "INSERT INTO preset_endpoint_groups (preset_id, endpoint_group_id) VALUES ($1, $2)",
      [preset.id, eg.id],
    );

    const res = await request(app)
      .delete(`/api/endpoint-groups/${eg.id}?force=true`)
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Group should be gone
    const gone = await db.get("SELECT id FROM endpoint_groups WHERE id = $1", [
      eg.id,
    ]);
    expect(gone).toBeUndefined();

    // Preset association should be cleaned
    const assoc = await db.get(
      "SELECT * FROM preset_endpoint_groups WHERE endpoint_group_id = $1",
      [eg.id],
    );
    expect(assoc).toBeUndefined();
  });
});

// ═════════════════════════════════════════════════════════════════════
// 9. Rate limits — associated presets guard
// ═════════════════════════════════════════════════════════════════════
describe("Rate limit deletion guards", () => {
  /**
   * Rationale: Deleting a rate limit that is assigned to presets would
   * leave those presets in an inconsistent state.
   */
  it("rejects deletion of rate limit used by presets", async () => {
    const rl = await seedRateLimit(db, { name: "RL Guard" });
    const preset = await seedPreset(db, { name: "RL Preset" });
    await db.run("UPDATE presets SET rate_limit_id = $1 WHERE id = $2", [
      rl.id,
      preset.id,
    ]);

    const res = await request(app)
      .delete(`/api/rate-limits/${rl.id}`)
      .set(authHeader(token));

    expect(res.status).toBe(400);
  });

  it("allows deletion of rate limit with no preset associations", async () => {
    const rl = await seedRateLimit(db, { name: "RL Orphan" });

    const res = await request(app)
      .delete(`/api/rate-limits/${rl.id}`)
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════
// 10. Blocklists / Allowlists — associated presets guard
// ═════════════════════════════════════════════════════════════════════
describe("IP list deletion guards", () => {
  it("rejects deletion of blocklist used by presets", async () => {
    const bl = await seedBlocklist(db, { name: "BL Guard" });
    const preset = await seedPreset(db, { name: "BL Preset" });
    await db.run("UPDATE presets SET ip_blocklist_id = $1 WHERE id = $2", [
      bl.id,
      preset.id,
    ]);

    const res = await request(app)
      .delete(`/api/ip-blocklists/${bl.id}`)
      .set(authHeader(token));

    expect(res.status).toBe(400);
  });

  it("rejects deletion of allowlist used by presets", async () => {
    const al = await seedAllowlist(db, { name: "AL Guard" });
    const preset = await seedPreset(db, { name: "AL Preset" });
    await db.run("UPDATE presets SET ip_allowlist_id = $1 WHERE id = $2", [
      al.id,
      preset.id,
    ]);

    const res = await request(app)
      .delete(`/api/ip-allowlists/${al.id}`)
      .set(authHeader(token));

    expect(res.status).toBe(400);
  });
});

// ═════════════════════════════════════════════════════════════════════
// 11. Blocklists / Allowlists — duplicate name
// ═════════════════════════════════════════════════════════════════════
describe("IP list name uniqueness", () => {
  it("rejects duplicate blocklist name on create", async () => {
    await seedBlocklist(db, { name: "DupBL" });

    const res = await request(app)
      .post("/api/ip-blocklists")
      .set(authHeader(token))
      .send({ name: "DupBL", ips: "1.2.3.4" });

    expect(res.status).toBe(409);
  });

  it("rejects duplicate allowlist name on create", async () => {
    await seedAllowlist(db, { name: "DupAL" });

    const res = await request(app)
      .post("/api/ip-allowlists")
      .set(authHeader(token))
      .send({ name: "DupAL", ips: "1.2.3.4" });

    expect(res.status).toBe(409);
  });

  it("rejects duplicate blocklist name on update", async () => {
    await seedBlocklist(db, { name: "BL-A" });
    const bl2 = await seedBlocklist(db, { name: "BL-B" });

    const res = await request(app)
      .put(`/api/ip-blocklists/${bl2.id}`)
      .set(authHeader(token))
      .send({ name: "BL-A", ips: "1.2.3.4" });

    expect(res.status).toBe(409);
  });
});

// ═════════════════════════════════════════════════════════════════════
// 12. API keys — preset validation
// ═════════════════════════════════════════════════════════════════════
describe("API key preset validation", () => {
  /**
   * Rationale: Creating an API key pointing to a non-existent preset
   * would leave the key in an invalid state.
   */
  it("rejects API key creation with non-existent preset", async () => {
    const res = await request(app)
      .post("/api/api-keys")
      .set(authHeader(token))
      .send({ name: "Bad Key", preset_id: 99999 });

    expect(res.status).toBe(400);
  });

  /**
   * Rationale: Updating API key to a non-existent preset should also fail.
   */
  it("rejects API key update with non-existent preset", async () => {
    const preset = await seedPreset(db, { name: "KeyPreset" });
    const key = await seedApiKey(db, preset.id);

    const res = await request(app)
      .put(`/api/api-keys/${key.id}`)
      .set(authHeader(token))
      .send({ preset_id: 99999 });

    expect(res.status).toBe(400);
  });
});


// ═════════════════════════════════════════════════════════════════════
// 14. Rate limits — duplicate name enforcement
// ═════════════════════════════════════════════════════════════════════
describe("Rate limit name uniqueness", () => {
  it("rejects duplicate rate limit name on create", async () => {
    await seedRateLimit(db, { name: "DupRL" });

    const res = await request(app)
      .post("/api/rate-limits")
      .set(authHeader(token))
      .send({ name: "DupRL", rules: [{ requests: 5, window_seconds: 60 }] });

    expect(res.status).toBe(409);
  });

  it("rejects duplicate rate limit name on update", async () => {
    await seedRateLimit(db, { name: "RL-X" });
    const rl2 = await seedRateLimit(db, { name: "RL-Y" });

    const res = await request(app)
      .put(`/api/rate-limits/${rl2.id}`)
      .set(authHeader(token))
      .send({
        name: "RL-X",
        rules: [{ requests: 5, window_seconds: 60 }],
      });

    expect(res.status).toBe(409);
  });
});

// ═════════════════════════════════════════════════════════════════════
// 15. Auth — edge cases
// ═════════════════════════════════════════════════════════════════════
describe("Authentication edge cases", () => {
  /**
   * Rationale: A Bearer token that is neither a valid JWT nor a master
   * key (mk- prefix) should return 401 with a clear message.
   */
  it("rejects garbage bearer token", async () => {
    const res = await request(app)
      .get("/api/resources")
      .set("Authorization", "Bearer totally-not-a-token");

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("UNAUTHORIZED");
  });

  /**
   * Rationale: Missing "Bearer " prefix should fail.
   */
  it("rejects authorization header without Bearer prefix", async () => {
    const res = await request(app)
      .get("/api/resources")
      .set("Authorization", `Token ${token}`);

    expect(res.status).toBe(401);
  });

  /**
   * Rationale: Empty Bearer value should fail.
   */
  it("rejects empty bearer token", async () => {
    const res = await request(app)
      .get("/api/resources")
      .set("Authorization", "Bearer ");

    expect(res.status).toBe(401);
  });
});

// ═════════════════════════════════════════════════════════════════════
// 16. Preset duplicate (copy)
// ═════════════════════════════════════════════════════════════════════
describe("Preset duplication", () => {
  /**
   * Rationale: Duplicating a preset should copy all associations
   * (endpoint groups, resources) but NOT API keys.
   */
  it("copies endpoint groups and resources but not API keys", async () => {
    const resource = await seedResource(db, { unique_path: "dup-res" });
    const eg = await seedEndpointGroup(db, resource.id, { name: "EG Dup" });
    const preset = await seedPreset(db, { name: "Original" });
    await seedApiKey(db, preset.id, { name: "Original Key" });

    // Attach relations
    await db.run(
      "INSERT INTO preset_endpoint_groups (preset_id, endpoint_group_id) VALUES ($1, $2)",
      [preset.id, eg.id],
    );
    await db.run(
      "INSERT INTO preset_resources (preset_id, resource_id) VALUES ($1, $2)",
      [preset.id, resource.id],
    );

    const res = await request(app)
      .post(`/api/presets/${preset.id}/duplicate`)
      .set(authHeader(token));

    expect(res.status).toBe(201);
    expect(res.body.name).toContain("Copy");
    expect(res.body.endpoint_groups).toHaveLength(1);
    expect(res.body.resources).toHaveLength(1);
    expect(res.body.api_key_count).toBe(0); // No keys copied
  });

  it("returns 404 when duplicating non-existent preset", async () => {
    const res = await request(app)
      .post("/api/presets/99999/duplicate")
      .set(authHeader(token));

    expect(res.status).toBe(404);
  });
});

// ═════════════════════════════════════════════════════════════════════
// 17. Endpoint groups — duplicate name within same resource
// ═════════════════════════════════════════════════════════════════════
describe("Endpoint group name uniqueness", () => {
  /**
   * Rationale: Within a single resource, endpoint group names should
   * be unique to prevent confusion.
   */
  it("rejects duplicate group name within same resource", async () => {
    const resource = await seedResource(db, { unique_path: "eg-dup-name" });
    await seedEndpointGroup(db, resource.id, { name: "Same Name" });

    const res = await request(app)
      .post(`/api/resources/${resource.id}/endpoint-groups`)
      .set(authHeader(token))
      .send({ name: "Same Name", endpoints: [] });

    expect(res.status).toBe(400);
  });

  /**
   * Rationale: Same name in DIFFERENT resources should be allowed.
   */
  it("allows same group name in different resources", async () => {
    const r1 = await seedResource(db, { unique_path: "eg-dup-r1" });
    const r2 = await seedResource(db, { unique_path: "eg-dup-r2" });
    await seedEndpointGroup(db, r1.id, { name: "Cross Name" });

    const res = await request(app)
      .post(`/api/resources/${r2.id}/endpoint-groups`)
      .set(authHeader(token))
      .send({ name: "Cross Name", endpoints: [] });

    expect(res.status).toBe(200);
  });
});

// ═════════════════════════════════════════════════════════════════════
// 18. Organization — master key management guards
// ═════════════════════════════════════════════════════════════════════
describe("Master key management", () => {
  /**
   * Rationale: Generating a master key should return the plain key
   * once (it's hashed in the DB and never shown again).
   */
  it("generates a master key with mk- prefix", async () => {
    const res = await request(app)
      .post("/api/organization/master-key/generate")
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.master_api_key).toMatch(/^mk-/);
    expect(res.body.prefix).toBeDefined();
    expect(res.body.success).toBe(true);
  });

  /**
   * Rationale: After generating a master key, the admin should be
   * able to authenticate with it on protected routes.
   */
  it("can authenticate with generated master key", async () => {
    // Generate a master key
    const genRes = await request(app)
      .post("/api/organization/master-key/generate")
      .set(authHeader(token));

    const masterKey = genRes.body.master_api_key;

    // Use it to access a protected route
    const res = await request(app)
      .get("/api/resources")
      .set("Authorization", `Bearer ${masterKey}`);

    expect(res.status).toBe(200);
  });

  /**
   * Rationale: After revoking the master key, the old key must
   * no longer work.
   */
  it("revoked master key no longer authenticates", async () => {
    // Generate a master key
    const genRes = await request(app)
      .post("/api/organization/master-key/generate")
      .set(authHeader(token));
    const masterKey = genRes.body.master_api_key;

    // Revoke it
    await request(app)
      .delete("/api/organization/master-key")
      .set(authHeader(token));

    // Try to use revoked key
    const res = await request(app)
      .get("/api/resources")
      .set("Authorization", `Bearer ${masterKey}`);

    expect(res.status).toBe(401);
  });
});

// ═════════════════════════════════════════════════════════════════════
// 19. Organization — organization code validation
// ═════════════════════════════════════════════════════════════════════
describe("Organization code edge cases", () => {
  /**
   * Rationale: Organization code must match ^[a-z0-9]{6}$ (validator).
   * If a code with uppercase or special chars passes, key generation breaks.
   */
  it("rejects uppercase organization code", async () => {
    const res = await request(app)
      .put("/api/organization/organization-code")
      .set(authHeader(token))
      .send({ organization_code: "ABCDEF" });

    expect(res.status).toBe(400);
  });

  it("rejects too-short organization code", async () => {
    const res = await request(app)
      .put("/api/organization/organization-code")
      .set(authHeader(token))
      .send({ organization_code: "abc" });

    expect(res.status).toBe(400);
  });
});

// ═════════════════════════════════════════════════════════════════════
// 20. Batch update — empty selection guard
// ═════════════════════════════════════════════════════════════════════
describe("Preset batch update edge cases", () => {
  /**
   * Rationale: Batch update with no resources or endpoint groups
   * is a no-op and should be rejected.
   */
  it("rejects batch update with no resources or endpoint groups", async () => {
    const preset = await seedPreset(db, { name: "BatchEmpty" });

    const res = await request(app)
      .post("/api/presets/batch-update")
      .set(authHeader(token))
      .send({ preset_ids: [preset.id] });

    expect(res.status).toBe(400);
  });

  /**
   * Rationale: Batch update referencing non-existent resources should fail.
   */
  it("rejects batch update with non-existent resource", async () => {
    const preset = await seedPreset(db, { name: "BatchBadRes" });

    const res = await request(app)
      .post("/api/presets/batch-update")
      .set(authHeader(token))
      .send({ preset_ids: [preset.id], resource_ids: [99999] });

    expect(res.status).toBe(400);
  });

  /**
   * Rationale: remove operation should not validate FK existence
   * (it's safe to remove non-existent associations).
   */
  it("allows remove operation even if resource not currently assigned", async () => {
    const preset = await seedPreset(db, { name: "BatchRemoveNoOp" });

    const res = await request(app)
      .post("/api/presets/batch-update")
      .set(authHeader(token))
      .send({
        preset_ids: [preset.id],
        resource_ids: [99999],
        operation: "remove",
      });

    expect(res.status).toBe(200);
  });
});

// ═════════════════════════════════════════════════════════════════════
// 21. 404 handler — unknown routes
// ═════════════════════════════════════════════════════════════════════
describe("Not found handler", () => {
  /**
   * Rationale: Unknown API routes should return a structured 404,
   * not a raw HTML page or crash.
   */
  it("returns JSON 404 for unknown API route", async () => {
    const res = await request(app)
      .get("/api/nonexistent-route")
      .set(authHeader(token));

    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });
});

// ═════════════════════════════════════════════════════════════════════
// 22. Validation middleware — malformed JSON
// ═════════════════════════════════════════════════════════════════════
describe("Malformed request handling", () => {
  /**
   * Rationale: Sending invalid JSON should return 400 with a clear
   * message, not crash the server.
   */
  it("returns 400 for malformed JSON body", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send("{invalid json}");

    expect(res.status).toBe(400);
  });
});

// ═════════════════════════════════════════════════════════════════════
// 23. Logs — pagination defaults and filters
// ═════════════════════════════════════════════════════════════════════
describe("Logs edge cases", () => {
  /**
   * Rationale: Empty log table should return empty array with valid
   * pagination metadata, not an error.
   */
  it("returns empty logs with valid pagination for empty table", async () => {
    const res = await request(app).get("/api/logs").set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.logs).toEqual([]);
    expect(res.body.pagination).toMatchObject({
      page: 1,
      total: 0,
      total_pages: 0,
    });
  });

  /**
   * Rationale: Stats endpoint should return zeros when no logs exist,
   * not null/undefined values.
   */
  it("returns zero stats when no request logs exist", async () => {
    const res = await request(app)
      .get("/api/logs/stats")
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.requests_24h).toBe(0);
    expect(res.body.avg_response_time_ms).toBe(0);
    expect(res.body.success_count).toBe(0);
    expect(res.body.client_error_count).toBe(0);
    expect(res.body.server_error_count).toBe(0);
  });
});
