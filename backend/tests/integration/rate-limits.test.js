/**
 * Integration tests for rate limit routes.
 *
 * Rate limits define request throttling rules (requests per window)
 * that can be assigned to presets. Each rate limit has a name, optional
 * response config, and one or more rules (requests per window_seconds).
 *
 * Routes:
 *   GET    /api/rate-limits
 *   POST   /api/rate-limits
 *   PUT    /api/rate-limits/:id
 *   GET    /api/rate-limits/:id/associated-presets
 *   DELETE /api/rate-limits/:id
 *
 * Response shapes:
 *   - list   → 200 flat array (each with .rules, .usage)
 *   - create → 201 { id, name, rules, response_code, ... }
 *   - update → 200 { id, name, rules, ... }
 *   - associatedPresets → 200 { associated_presets: [...] }
 *   - delete → 200 { success: true }
 */
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { createTestEnv } from "../helpers/setup.js";
import { loginAsAdmin, authHeader } from "../helpers/factories.js";
import {
  expectSuccess,
  expectNotFound,
  expectBadRequest,
} from "../helpers/assertions.js";

describe("Rate Limits Integration", () => {
  let app, db, token;

  beforeAll(async () => {
    ({ app, db } = await createTestEnv());
    const admin = await loginAsAdmin(app);
    token = admin.token;
  });

  // ═══════════════════════════════════════════════════════════════════
  // Create
  // ═══════════════════════════════════════════════════════════════════
  describe("POST /api/rate-limits", () => {
    /**
     * Rationale: A rate limit with rules is the primary use case.
     * Rules define sliding-window throttling (e.g., 100 req/min).
     * The transaction must insert both the rate limit header and
     * its rules atomically.
     */
    it("creates a rate limit with multiple rules", async () => {
      const res = await request(app)
        .post("/api/rate-limits")
        .set(authHeader(token))
        .send({
          name: "Standard Throttle",
          rules: [
            { requests: 100, window_seconds: 60 },
            { requests: 1000, window_seconds: 3600 },
          ],
        });

      expectSuccess(res, 201);
      expect(res.body.id).toBeDefined();
      expect(res.body.name).toBe("Standard Throttle");
      expect(res.body.rules).toHaveLength(2);
    });

    /**
     * Rationale: A rate limit without rules is valid. It acts as a
     * placeholder that can have rules added later via update.
     * This is useful for "no throttling" profiles.
     */
    it("creates a rate limit without rules", async () => {
      const res = await request(app)
        .post("/api/rate-limits")
        .set(authHeader(token))
        .send({ name: "No Rules Limit" });

      expectSuccess(res, 201);
      expect(res.body.id).toBeDefined();
    });

    /**
     * Rationale: response_code (429) and response_type ("json") are
     * system-locked. Even when explicitly sent, they are overridden.
     * Only the response_body is user-configurable.
     */
    it("ignores custom response_code and locks to 429", async () => {
      const res = await request(app)
        .post("/api/rate-limits")
        .set(authHeader(token))
        .send({
          name: "Custom Response RL",
          rules: [{ requests: 10, window_seconds: 60 }],
          response_code: 503,
          response_body: '{"error": "Service temporarily unavailable"}',
          response_type: "json",
        });

      expectSuccess(res, 201);
      expect(res.body.response_code).toBe(429);
      expect(res.body.response_body).toBe('{"error": "Service temporarily unavailable"}');
    });

    /**
     * Rationale: Rate limit names are unique (enforced by index).
     * Duplicates must be rejected.
     */
    it("rejects duplicate name", async () => {
      await request(app)
        .post("/api/rate-limits")
        .set(authHeader(token))
        .send({ name: "Dup RL", rules: [] });

      const res = await request(app)
        .post("/api/rate-limits")
        .set(authHeader(token))
        .send({ name: "Dup RL", rules: [] });

      expect(res.status).toBe(409);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // List
  // ═══════════════════════════════════════════════════════════════════
  describe("GET /api/rate-limits", () => {
    /**
     * Rationale: The list endpoint enriches each rate limit with:
     * - rules: the throttling windows
     * - usage: which presets reference it (preset_count, preset_names)
     * This data drives the admin UI for managing rate limits.
     */
    it("lists rate limits with rules and usage info", async () => {
      const res = await request(app)
        .get("/api/rate-limits")
        .set(authHeader(token));

      expectSuccess(res);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);

      // Every entry should have rules array and usage metadata
      const entry = res.body[0];
      expect(Array.isArray(entry.rules)).toBe(true);
      expect(entry).toHaveProperty("usage");
      expect(typeof entry.usage.preset_count).toBe("number");
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // Update
  // ═══════════════════════════════════════════════════════════════════
  describe("PUT /api/rate-limits/:id", () => {
    /**
     * Rationale: Updating a rate limit replaces both its name and its
     * rules atomically (within a transaction). Old rules are deleted
     * and new ones inserted. This ensures consistency.
     */
    it("updates name and replaces rules atomically", async () => {
      const createRes = await request(app)
        .post("/api/rate-limits")
        .set(authHeader(token))
        .send({
          name: "To Update RL",
          rules: [{ requests: 10, window_seconds: 60 }],
        });

      const res = await request(app)
        .put(`/api/rate-limits/${createRes.body.id}`)
        .set(authHeader(token))
        .send({
          name: "Updated RL",
          rules: [
            { requests: 500, window_seconds: 3600 },
            { requests: 50, window_seconds: 60 },
          ],
        });

      expectSuccess(res);
      expect(res.body.name).toBe("Updated RL");
      expect(res.body.rules).toHaveLength(2);
    });

    /**
     * Rationale: Updating rules to empty array should clear all rules
     * (equivalent to "no throttling").
     */
    it("clears all rules when updated with empty array", async () => {
      const createRes = await request(app)
        .post("/api/rate-limits")
        .set(authHeader(token))
        .send({
          name: "Clear Rules RL",
          rules: [{ requests: 10, window_seconds: 60 }],
        });

      const res = await request(app)
        .put(`/api/rate-limits/${createRes.body.id}`)
        .set(authHeader(token))
        .send({ name: "No Rules After Update", rules: [] });

      expectSuccess(res);

      // Verify the rules were actually removed from the DB
      const rules = await db.all(
        "SELECT * FROM rate_limit_rules WHERE rate_limit_id = $1",
        [createRes.body.id],
      );
      expect(rules).toHaveLength(0);
    });

    it("returns 404 for non-existent rate limit", async () => {
      const res = await request(app)
        .put("/api/rate-limits/99999")
        .set(authHeader(token))
        .send({ name: "Ghost", rules: [] });

      expectNotFound(res);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // Associated Presets
  // ═══════════════════════════════════════════════════════════════════
  describe("GET /api/rate-limits/:id/associated-presets", () => {
    /**
     * Rationale: An unassigned rate limit returns empty array.
     */
    it("returns empty array for unassigned rate limit", async () => {
      const createRes = await request(app)
        .post("/api/rate-limits")
        .set(authHeader(token))
        .send({ name: "Assoc Test RL", rules: [] });

      const res = await request(app)
        .get(`/api/rate-limits/${createRes.body.id}/associated-presets`)
        .set(authHeader(token));

      expectSuccess(res);
      expect(res.body.associated_presets).toEqual([]);
    });

    /**
     * Rationale: When a preset references a rate limit, the endpoint
     * must return those presets to enable deletion guard warnings.
     */
    it("returns associated presets when rate limit is in use", async () => {
      const rlRes = await request(app)
        .post("/api/rate-limits")
        .set(authHeader(token))
        .send({ name: "Linked RL", rules: [{ requests: 10, window_seconds: 60 }] });
      const rlId = rlRes.body.id;

      await request(app)
        .post("/api/presets")
        .set(authHeader(token))
        .send({ name: "Uses RL", rate_limit_id: rlId });

      const res = await request(app)
        .get(`/api/rate-limits/${rlId}/associated-presets`)
        .set(authHeader(token));

      expectSuccess(res);
      expect(res.body.associated_presets.length).toBeGreaterThanOrEqual(1);
      expect(res.body.associated_presets[0].name).toBe("Uses RL");
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // Delete
  // ═══════════════════════════════════════════════════════════════════
  describe("DELETE /api/rate-limits/:id", () => {
    /**
     * Rationale: Unused rate limits can be safely removed. Cascading
     * delete removes associated rules automatically.
     */
    it("deletes an unassigned rate limit", async () => {
      const createRes = await request(app)
        .post("/api/rate-limits")
        .set(authHeader(token))
        .send({ name: "To Delete RL", rules: [] });

      const res = await request(app)
        .delete(`/api/rate-limits/${createRes.body.id}`)
        .set(authHeader(token));

      expectSuccess(res);
      expect(res.body.success).toBe(true);
    });

    /**
     * Rationale: A rate limit assigned to presets cannot be deleted.
     * Removal would silently remove throttling from those presets,
     * which could cause unexpected traffic spikes to upstream APIs.
     */
    it("rejects deletion of rate limit in use by a preset", async () => {
      const rlRes = await request(app)
        .post("/api/rate-limits")
        .set(authHeader(token))
        .send({ name: "In Use RL", rules: [{ requests: 10, window_seconds: 60 }] });
      const rlId = rlRes.body.id;

      await request(app)
        .post("/api/presets")
        .set(authHeader(token))
        .send({ name: "Blocks RL Delete", rate_limit_id: rlId });

      const res = await request(app)
        .delete(`/api/rate-limits/${rlId}`)
        .set(authHeader(token));

      expectBadRequest(res);
    });

    it("returns 404 for non-existent rate limit", async () => {
      const res = await request(app)
        .delete("/api/rate-limits/99999")
        .set(authHeader(token));

      expectNotFound(res);
    });
  });
});
