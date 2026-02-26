/**
 * Integration tests for preset routes.
 *
 * Presets are reusable permission bundles that combine rate limits,
 * IP restrictions, and endpoint/resource access into a single profile.
 * The system seeds a "Master Access" preset marked as is_system=TRUE
 * which must be immutable (no edit, no delete, no batch-update).
 *
 * Routes:
 *   GET    /api/presets
 *   GET    /api/presets/:id
 *   POST   /api/presets
 *   PUT    /api/presets/:id
 *   POST   /api/presets/:id/duplicate
 *   DELETE /api/presets/:id
 *   POST   /api/presets/batch-update
 *
 * Response shapes:
 *   - create/update/get/duplicate → flat preset object with enriched relations
 *   - list       → flat array of enriched preset objects
 *   - delete     → { success: true }
 *   - batchUpdate → { success: true, updated_count }
 */
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { createTestEnv } from "../helpers/setup.js";
import {
  loginAsAdmin,
  seedResource,
  seedEndpointGroup,
  seedApiKey,
  seedPreset,
  seedRateLimit,
  seedAllowlist,
  seedBlocklist,
  authHeader,
} from "../helpers/factories.js";
import {
  expectSuccess,
  expectValidationError,
  expectNotFound,
  expectForbidden,
} from "../helpers/assertions.js";

describe("Presets Integration", () => {
  let app, db, token, project, endpointGroup;

  beforeAll(async () => {
    ({ app, db } = await createTestEnv());
    const admin = await loginAsAdmin(app);
    token = admin.token;
    project = await seedResource(db);
    endpointGroup = await seedEndpointGroup(db, project.id);
  });

  // ═══════════════════════════════════════════════════════════════════
  // Create
  // ═══════════════════════════════════════════════════════════════════
  describe("POST /api/presets", () => {
    /**
     * Rationale: The minimum viable preset has only a name. The system
     * should assign defaults for all optional fields (no rate limit,
     * no IP lists, empty endpoint groups and resources).
     */
    it("creates a preset with just a name", async () => {
      const res = await request(app)
        .post("/api/presets")
        .set(authHeader(token))
        .send({ name: "Standard Access" });

      expectSuccess(res, 201);
      expect(res.body.id).toBeDefined();
      expect(res.body.name).toBe("Standard Access");
      expect(res.body.rate_limit_id).toBeNull();
      expect(res.body.ip_allowlist_id).toBeNull();
      expect(res.body.ip_blocklist_id).toBeNull();
    });

    /**
     * Rationale: Presets can reference FK entities (rate limit, IP lists).
     * The controller must validate that referenced IDs actually exist
     * before inserting. This tests the full creation path with all
     * optional fields populated.
     */
    it("creates a preset with rate limit and IP lists", async () => {
      const rateLimit = await seedRateLimit(db, { name: "Preset RL" });
      const allowlist = await seedAllowlist(db, { name: "Preset AL" });
      const blocklist = await seedBlocklist(db, { name: "Preset BL" });

      const res = await request(app)
        .post("/api/presets")
        .set(authHeader(token))
        .send({
          name: "Full Config Preset",
          description: "Preset with all FK refs",
          rate_limit_id: rateLimit.id,
          ip_allowlist_id: allowlist.id,
          ip_blocklist_id: blocklist.id,
          endpoint_group_ids: [endpointGroup.id],
          resource_ids: [project.id],
        });

      expectSuccess(res, 201);
      expect(res.body.rate_limit_id).toBe(rateLimit.id);
      expect(res.body.ip_allowlist_id).toBe(allowlist.id);
      expect(res.body.ip_blocklist_id).toBe(blocklist.id);
      expect(res.body.rate_limit_name).toBe("Preset RL");
      expect(res.body.ip_allowlist_name).toBe("Preset AL");
      expect(res.body.ip_blocklist_name).toBe("Preset BL");
      expect(res.body.resources).toHaveLength(1);
      expect(res.body.endpoint_groups).toHaveLength(1);
    });

    /**
     * Rationale: Empty string names are invalid — every preset needs a
     * displayable name so admins can identify it in the UI.
     */
    it("rejects empty name", async () => {
      const res = await request(app)
        .post("/api/presets")
        .set(authHeader(token))
        .send({ name: "" });

      expectValidationError(res);
    });

    /**
     * Rationale: Preset names must be unique to prevent confusion
     * when assigning keys. Duplicate names return 409 Conflict.
     */
    it("rejects duplicate preset name", async () => {
      await request(app)
        .post("/api/presets")
        .set(authHeader(token))
        .send({ name: "Unique Preset" });

      const res = await request(app)
        .post("/api/presets")
        .set(authHeader(token))
        .send({ name: "Unique Preset" });

      expect(res.status).toBe(409);
    });

    /**
     * Rationale: Referencing a non-existent rate limit should fail
     * with a clear error rather than creating a broken preset.
     */
    it("rejects non-existent rate_limit_id", async () => {
      const res = await request(app)
        .post("/api/presets")
        .set(authHeader(token))
        .send({ name: "Bad RL Ref", rate_limit_id: 99999 });

      expect(res.status).toBe(400);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // List
  // ═══════════════════════════════════════════════════════════════════
  describe("GET /api/presets", () => {
    /**
     * Rationale: The list endpoint returns a flat array of enriched
     * presets. Each preset should include nested endpoint_groups,
     * resources, api_key_count, and resolved names for FK references.
     */
    it("returns enriched preset list with nested relations", async () => {
      const res = await request(app)
        .get("/api/presets")
        .set(authHeader(token));

      expectSuccess(res);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);

      // Each preset should have enrichment fields
      const preset = res.body[0];
      expect(preset).toHaveProperty("endpoint_groups");
      expect(preset).toHaveProperty("resources");
      expect(preset).toHaveProperty("api_key_count");
      expect(preset).toHaveProperty("rate_limit_name");
      expect(preset).toHaveProperty("ip_allowlist_name");
      expect(preset).toHaveProperty("ip_blocklist_name");
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // Get by ID
  // ═══════════════════════════════════════════════════════════════════
  describe("GET /api/presets/:id", () => {
    /**
     * Rationale: Fetching a single preset should return the full
     * enriched object, exactly matching what the edit UI needs.
     */
    it("returns a single enriched preset", async () => {
      const createRes = await request(app)
        .post("/api/presets")
        .set(authHeader(token))
        .send({ name: "Get By ID Preset" });

      const res = await request(app)
        .get(`/api/presets/${createRes.body.id}`)
        .set(authHeader(token));

      expectSuccess(res);
      expect(res.body.id).toBe(createRes.body.id);
      expect(res.body.name).toBe("Get By ID Preset");
      expect(Array.isArray(res.body.endpoint_groups)).toBe(true);
    });

    /**
     * Rationale: Non-existent IDs must return 404 to prevent the
     * frontend from showing stale or empty edit forms.
     */
    it("returns 404 for non-existent preset", async () => {
      const res = await request(app)
        .get("/api/presets/99999")
        .set(authHeader(token));

      expectNotFound(res);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // Update
  // ═══════════════════════════════════════════════════════════════════
  describe("PUT /api/presets/:id", () => {
    /**
     * Rationale: Partial updates should work — only the fields sent
     * in the body should change. The response includes the full
     * enriched preset so the UI can update immediately.
     */
    it("updates a preset name", async () => {
      const createRes = await request(app)
        .post("/api/presets")
        .set(authHeader(token))
        .send({ name: "Before Update" });

      const res = await request(app)
        .put(`/api/presets/${createRes.body.id}`)
        .set(authHeader(token))
        .send({ name: "After Update" });

      expectSuccess(res);
      expect(res.body.name).toBe("After Update");
    });

    /**
     * Rationale: The Master Access preset is seeded as is_system=TRUE.
     * System presets must be immutable — allowing edits would break
     * the guarantee that Master Access always provides full access.
     */
    it("rejects update of system (Master Access) preset", async () => {
      // Find the Master Access preset
      const masterPreset = await db.get(
        "SELECT id FROM presets WHERE is_system = TRUE",
      );
      expect(masterPreset).toBeDefined();

      const res = await request(app)
        .put(`/api/presets/${masterPreset.id}`)
        .set(authHeader(token))
        .send({ name: "Hijacked" });

      expectForbidden(res);

      // Verify the name was NOT changed
      const verify = await db.get(
        "SELECT name FROM presets WHERE id = $1",
        [masterPreset.id],
      );
      expect(verify.name).toBe("Master Access");
    });

    /**
     * Rationale: Non-existent preset IDs must 404 on update too,
     * otherwise the controller would silently succeed on nothing.
     */
    it("returns 404 for non-existent preset", async () => {
      const res = await request(app)
        .put("/api/presets/99999")
        .set(authHeader(token))
        .send({ name: "Ghost" });

      expectNotFound(res);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // Duplicate
  // ═══════════════════════════════════════════════════════════════════
  describe("POST /api/presets/:id/duplicate", () => {
    /**
     * Rationale: Duplicating a preset creates an independent copy with
     * "(Copy)" appended. The copy should inherit all FK references,
     * endpoint groups, and resource mappings but be a separate entity.
     */
    it("duplicates a preset with all relations", async () => {
      const rateLimit = await seedRateLimit(db, { name: "Dup RL" });
      const createRes = await request(app)
        .post("/api/presets")
        .set(authHeader(token))
        .send({
          name: "To Duplicate",
          rate_limit_id: rateLimit.id,
          resource_ids: [project.id],
          endpoint_group_ids: [endpointGroup.id],
        });

      const res = await request(app)
        .post(`/api/presets/${createRes.body.id}/duplicate`)
        .set(authHeader(token));

      expectSuccess(res, 201);
      expect(res.body.name).toContain("Copy");
      expect(res.body.id).not.toBe(createRes.body.id);
      expect(res.body.rate_limit_id).toBe(rateLimit.id);
      expect(res.body.resources).toHaveLength(1);
      expect(res.body.endpoint_groups).toHaveLength(1);
    });

    /**
     * Rationale: Duplicating a non-existent preset must 404.
     */
    it("returns 404 for non-existent preset", async () => {
      const res = await request(app)
        .post("/api/presets/99999/duplicate")
        .set(authHeader(token));

      expectNotFound(res);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // Delete
  // ═══════════════════════════════════════════════════════════════════
  describe("DELETE /api/presets/:id", () => {
    /**
     * Rationale: Deleting a preset with no assigned API keys should
     * succeed immediately. The DB cascades removal of join-table rows.
     */
    it("deletes a preset with no API keys", async () => {
      const createRes = await request(app)
        .post("/api/presets")
        .set(authHeader(token))
        .send({ name: "Delete Me" });

      const res = await request(app)
        .delete(`/api/presets/${createRes.body.id}`)
        .set(authHeader(token));

      expectSuccess(res);
      expect(res.body.success).toBe(true);

      // Verify the preset is actually gone
      const getRes = await request(app)
        .get(`/api/presets/${createRes.body.id}`)
        .set(authHeader(token));
      expectNotFound(getRes);
    });

    /**
     * Rationale: When API keys are assigned to a preset, deletion must
     * return 409 to force the admin to choose a reassignment target.
     * This prevents orphaned API keys that lose their permission profile.
     */
    it("returns 409 when API keys are assigned and no reassignment given", async () => {
      const preset = await seedPreset(db, { name: "Has Keys" });
      await seedApiKey(db, preset.id, { name: "Assigned Key" });

      const res = await request(app)
        .delete(`/api/presets/${preset.id}`)
        .set(authHeader(token));

      expect(res.status).toBe(409);
      expect(res.body.api_key_count).toBeGreaterThan(0);
    });

    /**
     * Rationale: The reassignment flow moves all API keys from the
     * deleted preset to a target preset, then deletes. This ensures
     * no API key ever loses its preset reference.
     */
    it("deletes preset with reassignment of API keys", async () => {
      const presetToDelete = await seedPreset(db, { name: "Will Delete" });
      const targetPreset = await seedPreset(db, { name: "Receives Keys" });
      await seedApiKey(db, presetToDelete.id, { name: "Migrating Key" });

      const res = await request(app)
        .delete(`/api/presets/${presetToDelete.id}?reassign_preset_id=${targetPreset.id}`)
        .set(authHeader(token));

      expectSuccess(res);
      expect(res.body.success).toBe(true);

      // Verify the key moved to the target preset
      const keys = await db.all(
        "SELECT * FROM api_keys WHERE preset_id = $1",
        [targetPreset.id],
      );
      expect(keys.length).toBeGreaterThanOrEqual(1);
    });

    /**
     * Rationale: The Master Access preset is the system's safety net.
     * Deleting it would remove the only guaranteed full-access profile.
     * The is_system flag prevents this permanently.
     */
    it("rejects deletion of system (Master Access) preset", async () => {
      const masterPreset = await db.get(
        "SELECT id FROM presets WHERE is_system = TRUE",
      );
      expect(masterPreset).toBeDefined();

      const res = await request(app)
        .delete(`/api/presets/${masterPreset.id}`)
        .set(authHeader(token));

      expectForbidden(res);

      // Verify it still exists
      const verify = await db.get(
        "SELECT id FROM presets WHERE id = $1",
        [masterPreset.id],
      );
      expect(verify).toBeDefined();
    });

    /**
     * Rationale: Non-existent preset returns 404.
     */
    it("returns 404 for non-existent preset", async () => {
      const res = await request(app)
        .delete("/api/presets/99999")
        .set(authHeader(token));

      expectNotFound(res);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // Batch Update
  // ═══════════════════════════════════════════════════════════════════
  describe("POST /api/presets/batch-update", () => {
    /**
     * Rationale: Batch add applies project and endpoint group
     * associations to multiple presets at once, such as when a new
     * resource is created and should be added to several presets.
     */
    it("batch-adds resources and endpoint groups to multiple presets", async () => {
      const p1 = await request(app)
        .post("/api/presets")
        .set(authHeader(token))
        .send({ name: "Batch Add 1" });
      const p2 = await request(app)
        .post("/api/presets")
        .set(authHeader(token))
        .send({ name: "Batch Add 2" });

      const res = await request(app)
        .post("/api/presets/batch-update")
        .set(authHeader(token))
        .send({
          preset_ids: [p1.body.id, p2.body.id],
          resource_ids: [project.id],
          endpoint_group_ids: [endpointGroup.id],
        });

      expectSuccess(res);
      expect(res.body.updated_count).toBe(2);

      // Verify associations were created
      const presetRes = await request(app)
        .get(`/api/presets/${p1.body.id}`)
        .set(authHeader(token));
      expect(presetRes.body.resources).toHaveLength(1);
      expect(presetRes.body.endpoint_groups).toHaveLength(1);
    });

    /**
     * Rationale: Batch remove removes specific associations from
     * presets, useful when decommissioning a resource.
     */
    it("batch-removes resources and endpoint groups from presets", async () => {
      const p1 = await request(app)
        .post("/api/presets")
        .set(authHeader(token))
        .send({
          name: "Batch Remove 1",
          resource_ids: [project.id],
          endpoint_group_ids: [endpointGroup.id],
        });

      const res = await request(app)
        .post("/api/presets/batch-update")
        .set(authHeader(token))
        .send({
          preset_ids: [p1.body.id],
          resource_ids: [project.id],
          endpoint_group_ids: [endpointGroup.id],
          operation: "remove",
        });

      expectSuccess(res);
      expect(res.body.updated_count).toBe(1);

      // Verify associations were removed
      const presetRes = await request(app)
        .get(`/api/presets/${p1.body.id}`)
        .set(authHeader(token));
      expect(presetRes.body.resources).toHaveLength(0);
      expect(presetRes.body.endpoint_groups).toHaveLength(0);
    });

    /**
     * Rationale: System presets (Master Access) must be excluded from
     * batch operations. Allowing batch-update on the system preset
     * could inadvertently restrict its full-access guarantee.
     */
    it("rejects batch-update that includes a system preset", async () => {
      const masterPreset = await db.get(
        "SELECT id FROM presets WHERE is_system = TRUE",
      );

      const res = await request(app)
        .post("/api/presets/batch-update")
        .set(authHeader(token))
        .send({
          preset_ids: [masterPreset.id],
          resource_ids: [project.id],
        });

      expectForbidden(res);
    });

    /**
     * Rationale: An empty payload (no projects or endpoint groups to
     * add/remove) wastes a round-trip and is likely a bug.
     */
    it("rejects batch-update with no resources", async () => {
      const p1 = await request(app)
        .post("/api/presets")
        .set(authHeader(token))
        .send({ name: "Batch No Resources" });

      const res = await request(app)
        .post("/api/presets/batch-update")
        .set(authHeader(token))
        .send({
          preset_ids: [p1.body.id],
        });

      expect(res.status).toBe(400);
    });
  });
});
