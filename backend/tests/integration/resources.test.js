/**
 * Integration tests for resource routes.
 *
 * Resources are the top-level entity — each resource represents an
 * external API being proxied. Tests cover CRUD operations.
 *
 * Response shapes from the controller:
 *   - create  → 200 flat { id, name, unique_path, ... }
 *   - list    → 200 flat array [{ ... }, ...]
 *   - getById → 200 flat { id, name, ... }
 *   - delete  → 200 { success: true }
 */
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { createTestEnv } from "../helpers/setup.js";
import { loginAsAdmin, authHeader } from "../helpers/factories.js";
import {
  expectSuccess,
  expectValidationError,
  expectNotFound,
} from "../helpers/assertions.js";

describe("Resources Integration", () => {
  let app, db, token;

  beforeAll(async () => {
    ({ app, db } = await createTestEnv());
    const admin = await loginAsAdmin(app);
    token = admin.token;
  });

  // ═══════════════════════════════════════════════════════════════════
  // Create
  // ═══════════════════════════════════════════════════════════════════
  describe("POST /api/resources", () => {
    /**
     * Rationale: Happy path — an admin creates a resource.
     * Controller returns 200 with a flat object containing the new id.
     */
    it("creates a resource with valid data", async () => {
      const res = await request(app)
        .post("/api/resources")
        .set(authHeader(token))
        .send({
          name: "My API",
          unique_path: "my-api",
          secret_api_key: "sk-test",
          external_api_url: "https://api.example.com",
        });

      expectSuccess(res, 200);
      expect(res.body.id).toBeDefined();
      expect(res.body.name).toBe("My API");
    });

    /**
     * Rationale: All required fields must be validated. Missing the name
     * should return a clear validation error.
     */
    it("returns 400 when name is missing", async () => {
      const res = await request(app)
        .post("/api/resources")
        .set(authHeader(token))
        .send({
          unique_path: "no-name",
          secret_api_key: "sk-test",
          external_api_url: "https://api.example.com",
        });

      expectValidationError(res);
    });

    /**
     * Rationale: The schema requires at least one of external_api_url
     * or external_api_base_url. Omitting both should fail.
     */
    it("returns 400 when no external API URL is provided", async () => {
      const res = await request(app)
        .post("/api/resources")
        .set(authHeader(token))
        .send({
          name: "No URL",
          unique_path: "no-url",
          secret_api_key: "sk-test",
        });

      expectValidationError(res);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // Read
  // ═══════════════════════════════════════════════════════════════════
  describe("GET /api/resources", () => {
    /**
     * Rationale: Listing resources returns a flat array (not wrapped in
     * a `resources` key). Must contain the resource created above.
     */
    it("lists all resources for the account", async () => {
      const res = await request(app)
        .get("/api/resources")
        .set(authHeader(token));

      expectSuccess(res);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("GET /api/resources/:id", () => {
    /**
     * Rationale: Retrieving a specific resource by ID must return
     * its full details as a flat object.
     */
    it("returns a specific resource", async () => {
      // Create one first
      const createRes = await request(app)
        .post("/api/resources")
        .set(authHeader(token))
        .send({
          name: "Detail Resource",
          unique_path: "detail-resource",
          secret_api_key: "sk-detail",
          external_api_url: "https://detail.example.com",
        });
      const resourceId = createRes.body.id;

      const res = await request(app)
        .get(`/api/resources/${resourceId}`)
        .set(authHeader(token));

      expectSuccess(res);
      expect(res.body.name).toBe("Detail Resource");
    });

    /**
     * Rationale: Requesting a non-existent ID should return 404,
     * not 500 or an empty response.
     */
    it("returns 404 for non-existent resource", async () => {
      const res = await request(app)
        .get("/api/resources/99999")
        .set(authHeader(token));

      expectNotFound(res);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // Update
  // ═══════════════════════════════════════════════════════════════════
  describe("PUT /api/resources/:id", () => {
    /**
     * Rationale: Updating a resource changes its name and external API URL.
     * Returns 200 with the updated flat object.
     */
    it("updates a resource with valid data", async () => {
      const createRes = await request(app)
        .post("/api/resources")
        .set(authHeader(token))
        .send({
          name: "To Update",
          unique_path: "to-update",
          secret_api_key: "sk-update",
          external_api_url: "https://update.example.com",
        });
      const resourceId = createRes.body.id;

      const res = await request(app)
        .put(`/api/resources/${resourceId}`)
        .set(authHeader(token))
        .send({
          name: "Updated Name",
          secret_api_key: "sk-updated",
          external_api_url: "https://updated.example.com",
        });

      expectSuccess(res);
      expect(res.body.name).toBe("Updated Name");
    });

    /**
     * Rationale: Updating a non-existent resource should return 404.
     */
    it("returns 404 for non-existent resource", async () => {
      const res = await request(app)
        .put("/api/resources/99999")
        .set(authHeader(token))
        .send({
          name: "Ghost",
          secret_api_key: "sk-ghost",
          external_api_url: "https://ghost.example.com",
        });

      expectNotFound(res);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // Delete
  // ═══════════════════════════════════════════════════════════════════
  describe("DELETE /api/resources/:id", () => {
    /**
     * Rationale: Deleting a resource must remove it from the database
     * and return { success: true }.
     */
    it("deletes a resource", async () => {
      const createRes = await request(app)
        .post("/api/resources")
        .set(authHeader(token))
        .send({
          name: "To Delete",
          unique_path: "to-delete",
          secret_api_key: "sk-delete",
          external_api_url: "https://delete.example.com",
        });
      const resourceId = createRes.body.id;

      const res = await request(app)
        .delete(`/api/resources/${resourceId}`)
        .set(authHeader(token));

      expectSuccess(res);

      // Verify it's gone
      const getRes = await request(app)
        .get(`/api/resources/${resourceId}`)
        .set(authHeader(token));

      expectNotFound(getRes);
    });
  });
});
