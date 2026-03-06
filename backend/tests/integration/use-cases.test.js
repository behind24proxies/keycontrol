/**
 * Integration tests for use case routes.
 *
 * Use cases represent specific API consumption patterns (e.g., "Mobile App").
 * Each use case gets its own API key and is tied to a preset.
 *
 * Response shapes from the controller:
 *   - create → 201 flat use case object
 *   - list   → 200 { api_keys: [...], pagination }
 *   - delete → 200 { success: true }
 */
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { createTestEnv } from "../helpers/setup.js";
import { loginAsAdmin, authHeader } from "../helpers/factories.js";
import { expectSuccess, expectValidationError, expectNotFound } from "../helpers/assertions.js";

describe("API Keys Integration", () => {
  let app, db, token, presetId;

  beforeAll(async () => {
    ({ app, db } = await createTestEnv());
    const admin = await loginAsAdmin(app);
    token = admin.token;

    // Create a preset for use cases (returns flat object with .id)
    const presetRes = await request(app)
      .post("/api/presets")
      .set(authHeader(token))
      .send({ name: "UC Preset" });
    presetId = presetRes.body.id;
  });

  // ═══════════════════════════════════════════════════════════════════
  // Create
  // ═══════════════════════════════════════════════════════════════════
  describe("POST /api/api-keys", () => {
    /**
     * Rationale: Creating a use case must return 201 with a flat
     * use case object containing an auto-generated API key.
     */
    it("creates a use case with valid data", async () => {
      const res = await request(app)
        .post("/api/api-keys")
        .set(authHeader(token))
        .send({
          name: "Mobile App",
          preset_id: presetId,
        });

      expectSuccess(res, 201);
      expect(res.body.id).toBeDefined();
      expect(res.body.name).toBe("Mobile App");
      expect(res.body.api_key).toBeDefined();
    });

    /**
     * Rationale: Name is required for identification.
     */
    it("returns 400 for missing name", async () => {
      const res = await request(app)
        .post("/api/api-keys")
        .set(authHeader(token))
        .send({ preset_id: presetId });

      expectValidationError(res);
    });

    /**
     * Rationale: preset_id is required — links the use case to
     * its permission profile.
     */
    it("returns 400 for missing preset_id", async () => {
      const res = await request(app)
        .post("/api/api-keys")
        .set(authHeader(token))
        .send({ name: "No Preset" });

      expectValidationError(res);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // List
  // ═══════════════════════════════════════════════════════════════════
  describe("GET /api/api-keys", () => {
    /**
     * Rationale: Listing should return { api_keys: [...] }.
     */
    it("lists all use cases", async () => {
      const res = await request(app)
        .get("/api/api-keys")
        .set(authHeader(token));

      expectSuccess(res);
      expect(Array.isArray(res.body.api_keys)).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // Update
  // ═══════════════════════════════════════════════════════════════════
  describe("PUT /api/api-keys/:id", () => {
    /**
     * Rationale: Updating a use case's name and description should
     * return the full updated use case as a flat object.
     */
    it("updates a use case with valid data", async () => {
      const createRes = await request(app)
        .post("/api/api-keys")
        .set(authHeader(token))
        .send({ name: "To Update UC", preset_id: presetId });
      const ucId = createRes.body.id;

      const res = await request(app)
        .put(`/api/api-keys/${ucId}`)
        .set(authHeader(token))
        .send({ name: "Updated UC", description: "Updated description" });

      expectSuccess(res);
      expect(res.body.name).toBe("Updated UC");
    });

    /**
     * Rationale: Non-existent use case should return 404.
     */
    it("returns 404 for non-existent use case", async () => {
      const res = await request(app)
        .put("/api/api-keys/99999")
        .set(authHeader(token))
        .send({ name: "Ghost" });

      expectNotFound(res);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // Stats — Per-key quota
  // ═══════════════════════════════════════════════════════════════════
  describe("GET /api/api-keys/:id/stats — quota fields", () => {
    /**
     * Rationale: The stats response should include the key's configured
     * quota limits and current global usage/expiry data.
     */
    it("returns quota config and global counts in stats", async () => {
      const createRes = await request(app)
        .post("/api/api-keys")
        .set(authHeader(token))
        .send({
          name: "Quota Stats Key",
          preset_id: presetId,
          usage_limit: 1000,
          lease_duration_seconds: 86400,
        });
      expectSuccess(createRes, 201);
      const keyId = createRes.body.id;

      const statsRes = await request(app)
        .get(`/api/api-keys/${keyId}/stats`)
        .set(authHeader(token));

      expectSuccess(statsRes);
      expect(statsRes.body.usage_limit).toBe(1000);
      expect(statsRes.body.lease_duration_seconds).toBe(86400);
      expect(statsRes.body.global_usage_count).toBe(0);
      expect(statsRes.body.global_expiry_date).toBeNull();
    });

    /**
     * Rationale: Stats for a key with no quotas should return null
     * for both quota config fields.
     */
    it("returns null for quota fields when not configured", async () => {
      const createRes = await request(app)
        .post("/api/api-keys")
        .set(authHeader(token))
        .send({
          name: "No Quota Stats Key",
          preset_id: presetId,
        });
      const keyId = createRes.body.id;

      const statsRes = await request(app)
        .get(`/api/api-keys/${keyId}/stats`)
        .set(authHeader(token));

      expectSuccess(statsRes);
      expect(statsRes.body.usage_limit).toBeNull();
      expect(statsRes.body.lease_duration_seconds).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // Create — with quota fields
  // ═══════════════════════════════════════════════════════════════════
  describe("POST /api/api-keys — quota fields", () => {
    /**
     * Rationale: Should accept and persist per-key quota fields on creation.
     */
    it("creates an API key with usage_limit and lease_duration_seconds", async () => {
      const res = await request(app)
        .post("/api/api-keys")
        .set(authHeader(token))
        .send({
          name: "Quota Key",
          preset_id: presetId,
          usage_limit: 500,
          lease_duration_seconds: 3600,
        });

      expectSuccess(res, 201);
      expect(res.body.usage_limit).toBe(500);
      expect(res.body.lease_duration_seconds).toBe(3600);
    });

    /**
     * Rationale: Omitting quota fields should default to null (unlimited).
     */
    it("defaults quota fields to null when omitted", async () => {
      const res = await request(app)
        .post("/api/api-keys")
        .set(authHeader(token))
        .send({
          name: "No Quota Key",
          preset_id: presetId,
        });

      expectSuccess(res, 201);
      expect(res.body.usage_limit).toBeNull();
      expect(res.body.lease_duration_seconds).toBeNull();
    });

    /**
     * Rationale: Zero or negative quota values are invalid.
     */
    it("rejects non-positive usage_limit", async () => {
      const res = await request(app)
        .post("/api/api-keys")
        .set(authHeader(token))
        .send({
          name: "Bad Quota Key",
          preset_id: presetId,
          usage_limit: 0,
        });

      expectValidationError(res);
    });

    /**
     * Rationale: Zero or negative lease is invalid.
     */
    it("rejects non-positive lease_duration_seconds", async () => {
      const res = await request(app)
        .post("/api/api-keys")
        .set(authHeader(token))
        .send({
          name: "Bad Lease Key",
          preset_id: presetId,
          lease_duration_seconds: -1,
        });

      expectValidationError(res);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // Update — quota fields
  // ═══════════════════════════════════════════════════════════════════
  describe("PUT /api/api-keys/:id — quota fields", () => {
    /**
     * Rationale: Should be able to set quotas on an existing key.
     */
    it("sets quota fields on an existing key", async () => {
      const createRes = await request(app)
        .post("/api/api-keys")
        .set(authHeader(token))
        .send({ name: "Update Quota Key", preset_id: presetId });
      const ucId = createRes.body.id;

      const res = await request(app)
        .put(`/api/api-keys/${ucId}`)
        .set(authHeader(token))
        .send({ usage_limit: 200, lease_duration_seconds: 7200 });

      expectSuccess(res);
      expect(res.body.usage_limit).toBe(200);
      expect(res.body.lease_duration_seconds).toBe(7200);
    });

    /**
     * Rationale: Setting quota fields to null should clear them.
     */
    it("clears quota fields when set to null", async () => {
      const createRes = await request(app)
        .post("/api/api-keys")
        .set(authHeader(token))
        .send({
          name: "Clear Quota Key",
          preset_id: presetId,
          usage_limit: 100,
          lease_duration_seconds: 3600,
        });
      const ucId = createRes.body.id;

      const res = await request(app)
        .put(`/api/api-keys/${ucId}`)
        .set(authHeader(token))
        .send({ usage_limit: null, lease_duration_seconds: null });

      expectSuccess(res);
      expect(res.body.usage_limit).toBeNull();
      expect(res.body.lease_duration_seconds).toBeNull();
    });

    /**
     * Rationale: Omitting quota fields in update should preserve existing values.
     */
    it("preserves quota fields when not sent", async () => {
      const createRes = await request(app)
        .post("/api/api-keys")
        .set(authHeader(token))
        .send({
          name: "Preserve Quota Key",
          preset_id: presetId,
          usage_limit: 300,
          lease_duration_seconds: 1800,
        });
      const ucId = createRes.body.id;

      // Update only the name — quotas should stay
      const res = await request(app)
        .put(`/api/api-keys/${ucId}`)
        .set(authHeader(token))
        .send({ name: "Renamed Key" });

      expectSuccess(res);
      expect(res.body.name).toBe("Renamed Key");
      expect(res.body.usage_limit).toBe(300);
      expect(res.body.lease_duration_seconds).toBe(1800);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // Delete
  // ═══════════════════════════════════════════════════════════════════
  describe("DELETE /api/api-keys/:id", () => {
    /**
     * Rationale: Deleting a use case removes it and returns { success: true }.
     */
    it("deletes a use case", async () => {
      const createRes = await request(app)
        .post("/api/api-keys")
        .set(authHeader(token))
        .send({ name: "To Delete", preset_id: presetId });
      const ucId = createRes.body.id;

      const res = await request(app)
        .delete(`/api/api-keys/${ucId}`)
        .set(authHeader(token));

      expectSuccess(res);
      expect(res.body.success).toBe(true);
    });

    /**
     * Rationale: Deleting a non-existent use case should return 404.
     */
    it("returns 404 for non-existent use case", async () => {
      const res = await request(app)
        .delete("/api/api-keys/99999")
        .set(authHeader(token));

      expectNotFound(res);
    });
  });
});
