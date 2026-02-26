/**
 * Integration tests for endpoint group routes.
 *
 * Endpoint groups organise endpoints within a project for fine-grained
 * access control via presets.
 *
 * Routes:
 *   POST   /api/resources/:projectId/endpoint-groups
 *   PUT    /api/endpoint-groups/:id
 *   GET    /api/endpoint-groups/:id/associated-keys
 *   DELETE /api/endpoint-groups/:id
 *
 * Response shapes (from controller):
 *   - create → 200 { id, name, description, endpoints }
 *   - update → 200 { id, name, description, endpoints }
 *   - getAssociatedKeys → 200 { associated_presets: [...] }
 *   - delete → 200 { success: true }
 */
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { createTestEnv } from "../helpers/setup.js";
import { loginAsAdmin, seedResource, authHeader } from "../helpers/factories.js";
import {
  expectSuccess,
  expectValidationError,
  expectNotFound,
} from "../helpers/assertions.js";

describe("Endpoint Groups Integration", () => {
  let app, db, token, project;

  beforeAll(async () => {
    ({ app, db } = await createTestEnv());
    const admin = await loginAsAdmin(app);
    token = admin.token;
    project = await seedResource(db);
  });

  // ═══════════════════════════════════════════════════════════════════
  // Create
  // ═══════════════════════════════════════════════════════════════════
  describe("POST /api/resources/:projectId/endpoint-groups", () => {
    /**
     * Rationale: Creating an endpoint group with a name and endpoints
     * returns the created group with its id.
     */
    it("creates an endpoint group with endpoints", async () => {
      const res = await request(app)
        .post(`/api/resources/${project.id}/endpoint-groups`)
        .set(authHeader(token))
        .send({
          name: "Auth Endpoints",
          description: "Authentication API routes",
          endpoints: [
            { url_pattern: "/auth/login", method: "POST" },
            { url_pattern: "/auth/signup", method: "POST" },
          ],
        });

      expectSuccess(res);
      expect(res.body.id).toBeDefined();
      expect(res.body.name).toBe("Auth Endpoints");
    });

    /**
     * Rationale: Creating without endpoints should still succeed,
     * producing an empty endpoint set.
     */
    it("creates an endpoint group without endpoints", async () => {
      const res = await request(app)
        .post(`/api/resources/${project.id}/endpoint-groups`)
        .set(authHeader(token))
        .send({ name: "Empty Group" });

      expectSuccess(res);
      expect(res.body.id).toBeDefined();
    });

    /**
     * Rationale: Duplicate names within the same project must be
     * rejected to prevent ambiguity in preset config.
     */
    it("rejects duplicate name within same project", async () => {
      // Create first
      await request(app)
        .post(`/api/resources/${project.id}/endpoint-groups`)
        .set(authHeader(token))
        .send({ name: "Unique Name" });

      // Try duplicate
      const res = await request(app)
        .post(`/api/resources/${project.id}/endpoint-groups`)
        .set(authHeader(token))
        .send({ name: "Unique Name" });

      expect(res.status).toBe(400);
    });

    /**
     * Rationale: Missing name should trigger validation error.
     */
    it("returns 400 for missing name", async () => {
      const res = await request(app)
        .post(`/api/resources/${project.id}/endpoint-groups`)
        .set(authHeader(token))
        .send({});

      expectValidationError(res);
    });

    /**
     * Rationale: Creating under a non-existent project should 404.
     */
    it("returns 404 for non-existent project", async () => {
      const res = await request(app)
        .post("/api/resources/99999/endpoint-groups")
        .set(authHeader(token))
        .send({ name: "Ghost Group" });

      expectNotFound(res);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // Update
  // ═══════════════════════════════════════════════════════════════════
  describe("PUT /api/endpoint-groups/:id", () => {
    /**
     * Rationale: Updating name and endpoints replaces the old values.
     */
    it("updates an endpoint group", async () => {
      const createRes = await request(app)
        .post(`/api/resources/${project.id}/endpoint-groups`)
        .set(authHeader(token))
        .send({ name: "To Update" });
      const groupId = createRes.body.id;

      const res = await request(app)
        .put(`/api/endpoint-groups/${groupId}`)
        .set(authHeader(token))
        .send({
          name: "Updated Group",
          endpoints: [{ url_pattern: "/new/*", method: "GET" }],
        });

      expectSuccess(res);
      expect(res.body.name).toBe("Updated Group");
    });

    /**
     * Rationale: Non-existent group should return 404.
     */
    it("returns 404 for non-existent group", async () => {
      const res = await request(app)
        .put("/api/endpoint-groups/99999")
        .set(authHeader(token))
        .send({ name: "Ghost" });

      expectNotFound(res);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // Associated Presets
  // ═══════════════════════════════════════════════════════════════════
  describe("GET /api/endpoint-groups/:id/associated-keys", () => {
    /**
     * Rationale: New group with no preset associations returns empty array.
     */
    it("returns empty associated presets for new group", async () => {
      const createRes = await request(app)
        .post(`/api/resources/${project.id}/endpoint-groups`)
        .set(authHeader(token))
        .send({ name: "No Presets Group" });
      const groupId = createRes.body.id;

      const res = await request(app)
        .get(`/api/endpoint-groups/${groupId}/associated-keys`)
        .set(authHeader(token));

      expectSuccess(res);
      expect(res.body.associated_presets).toEqual([]);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // Delete
  // ═══════════════════════════════════════════════════════════════════
  describe("DELETE /api/endpoint-groups/:id", () => {
    /**
     * Rationale: Deleting a group with no preset associations succeeds.
     */
    it("deletes an unassociated endpoint group", async () => {
      const createRes = await request(app)
        .post(`/api/resources/${project.id}/endpoint-groups`)
        .set(authHeader(token))
        .send({ name: "To Delete" });
      const groupId = createRes.body.id;

      const res = await request(app)
        .delete(`/api/endpoint-groups/${groupId}`)
        .set(authHeader(token));

      expectSuccess(res);
      expect(res.body.success).toBe(true);
    });

    /**
     * Rationale: Non-existent group should return 404.
     */
    it("returns 404 for non-existent group", async () => {
      const res = await request(app)
        .delete("/api/endpoint-groups/99999")
        .set(authHeader(token));

      expectNotFound(res);
    });

    /**
     * Rationale: Deleting a group used by a preset should return
     * confirm_required with preset info.
     */
    it("returns confirm_required when group is used by a preset", async () => {
      // Create a group and a preset that uses it
      const groupRes = await request(app)
        .post(`/api/resources/${project.id}/endpoint-groups`)
        .set(authHeader(token))
        .send({ name: "Used By Preset" });
      const groupId = groupRes.body.id;

      await request(app)
        .post("/api/presets")
        .set(authHeader(token))
        .send({ name: "Refs Group", endpoint_group_ids: [groupId], project_ids: [project.id] });

      // Delete without force — should ask for confirmation
      const res = await request(app)
        .delete(`/api/endpoint-groups/${groupId}`)
        .set(authHeader(token));

      expectSuccess(res);
      expect(res.body.confirm_required).toBe(true);
      expect(res.body.associated_preset_count).toBe(1);
      expect(res.body.associated_presets).toHaveLength(1);
    });

    /**
     * Rationale: Force-deleting a group used by a preset should
     * cascade-remove the join rows and succeed.
     */
    it("force-deletes a group used by a preset", async () => {
      // Create a group and a preset that uses it
      const groupRes = await request(app)
        .post(`/api/resources/${project.id}/endpoint-groups`)
        .set(authHeader(token))
        .send({ name: "Force Delete Me" });
      const groupId = groupRes.body.id;

      await request(app)
        .post("/api/presets")
        .set(authHeader(token))
        .send({ name: "Refs Force", endpoint_group_ids: [groupId], project_ids: [project.id] });

      // Delete with force
      const res = await request(app)
        .delete(`/api/endpoint-groups/${groupId}?force=true`)
        .set(authHeader(token));

      expectSuccess(res);
      expect(res.body.success).toBe(true);
    });
  });
});
