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
  // Rotate Key
  // ═══════════════════════════════════════════════════════════════════
  describe("POST /api/api-keys/:id/rotate-key", () => {
    /**
     * Rationale: Rotating a key generates a new API key. The response
     * must contain the new key string.
     */
    it("rotates the API key for a use case", async () => {
      const createRes = await request(app)
        .post("/api/api-keys")
        .set(authHeader(token))
        .send({ name: "Rotate UC", preset_id: presetId });
      const ucId = createRes.body.id;
      const oldKey = createRes.body.api_key;

      const res = await request(app)
        .post(`/api/api-keys/${ucId}/rotate-key`)
        .set(authHeader(token));

      expectSuccess(res);
      expect(res.body.api_key).toBeDefined();
      expect(res.body.api_key).not.toBe(oldKey);
    });

    /**
     * Rationale: Non-existent use case returns 404.
     */
    it("returns 404 for non-existent use case", async () => {
      const res = await request(app)
        .post("/api/api-keys/99999/rotate-key")
        .set(authHeader(token));

      expectNotFound(res);
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
