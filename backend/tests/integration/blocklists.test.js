/**
 * Integration tests for IP blocklist routes.
 *
 * IP blocklists block API access from specific IPs or CIDR ranges.
 * They mirror allowlists but with blocking semantics. Blocklists
 * can define custom HTTP response codes and bodies.
 *
 * Routes:
 *   GET    /api/ip-blocklists
 *   POST   /api/ip-blocklists
 *   PUT    /api/ip-blocklists/:id
 *   GET    /api/ip-blocklists/:id/associated-presets
 *   DELETE /api/ip-blocklists/:id
 */
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { createTestEnv } from "../helpers/setup.js";
import { loginAsAdmin, authHeader } from "../helpers/factories.js";
import {
  expectSuccess,
  expectValidationError,
  expectNotFound,
  expectBadRequest,
} from "../helpers/assertions.js";

describe("IP Blocklists Integration", () => {
  let app, db, token;

  beforeAll(async () => {
    ({ app, db } = await createTestEnv());
    const admin = await loginAsAdmin(app);
    token = admin.token;
  });

  // ═══════════════════════════════════════════════════════════════════
  // Create
  // ═══════════════════════════════════════════════════════════════════
  describe("POST /api/ip-blocklists", () => {
    /**
     * Rationale: Minimum valid blocklist — a single IP address.
     * Defaults (403 status, JSON response) should be applied.
     */
    it("creates a blocklist with a single IP", async () => {
      const res = await request(app)
        .post("/api/ip-blocklists")
        .set(authHeader(token))
        .send({ name: "Bad Actor", ips: "192.168.1.100" });

      expectSuccess(res, 201);
      expect(res.body.id).toBeDefined();
      expect(res.body.name).toBe("Bad Actor");
      expect(res.body.response_code).toBe(403);
    });

    /**
     * Rationale: Multiple comma-separated IPs should be accepted
     * as a single string, matching the schema's TEXT column.
     */
    it("creates a blocklist with multiple IPs", async () => {
      const res = await request(app)
        .post("/api/ip-blocklists")
        .set(authHeader(token))
        .send({ name: "Multi Block", ips: "1.1.1.1,2.2.2.2,3.3.3.3" });

      expectSuccess(res, 201);
      expect(res.body.ips).toBe("1.1.1.1,2.2.2.2,3.3.3.3");
    });

    /**
     * Rationale: response_code (403) and response_type ("json") are
     * system-locked. Even when 451 is sent, the system overrides it.
     * Only the response_body is user-configurable.
     */
    it("ignores custom 451 response code and locks to 403", async () => {
      const res = await request(app)
        .post("/api/ip-blocklists")
        .set(authHeader(token))
        .send({
          name: "Geo Block",
          ips: "192.0.2.0/24",
          response_code: 451,
          response_body: '{"error": "Unavailable for legal reasons"}',
        });

      expectSuccess(res, 201);
      expect(res.body.response_code).toBe(403);
      expect(res.body.response_body).toBe('{"error": "Unavailable for legal reasons"}');
    });

    /**
     * Rationale: Duplicate names must be rejected (unique index).
     */
    it("rejects duplicate name", async () => {
      await request(app)
        .post("/api/ip-blocklists")
        .set(authHeader(token))
        .send({ name: "Dup Block", ips: "1.1.1.1" });

      const res = await request(app)
        .post("/api/ip-blocklists")
        .set(authHeader(token))
        .send({ name: "Dup Block", ips: "2.2.2.2" });

      expect(res.status).toBe(409);
    });

    /**
     * Rationale: Missing required fields (name, ips) must trigger
     * validation errors.
     */
    it("rejects missing name", async () => {
      const res = await request(app)
        .post("/api/ip-blocklists")
        .set(authHeader(token))
        .send({ ips: "1.2.3.4" });

      expectValidationError(res);
    });

    it("rejects missing ips", async () => {
      const res = await request(app)
        .post("/api/ip-blocklists")
        .set(authHeader(token))
        .send({ name: "No IPs" });

      expectValidationError(res);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // List
  // ═══════════════════════════════════════════════════════════════════
  describe("GET /api/ip-blocklists", () => {
    /**
     * Rationale: The list endpoint enriches each blocklist with usage
     * info (which presets reference it). This data drives the UI's
     * "in use" badges and deletion guard warnings.
     */
    it("lists blocklists with usage metadata", async () => {
      const res = await request(app)
        .get("/api/ip-blocklists")
        .set(authHeader(token));

      expectSuccess(res);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);

      const entry = res.body[0];
      expect(entry).toHaveProperty("usage");
      expect(typeof entry.usage.preset_count).toBe("number");
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // Update
  // ═══════════════════════════════════════════════════════════════════
  describe("PUT /api/ip-blocklists/:id", () => {
    /**
     * Rationale: Updates replace name, IPs, and response_body.
     * response_code remains locked to 403 regardless of what is sent.
     */
    it("updates blocklist name, IPs, and response body (code stays locked)", async () => {
      const createRes = await request(app)
        .post("/api/ip-blocklists")
        .set(authHeader(token))
        .send({ name: "To Update Block", ips: "1.1.1.1" });

      const res = await request(app)
        .put(`/api/ip-blocklists/${createRes.body.id}`)
        .set(authHeader(token))
        .send({
          name: "Updated Block",
          ips: "2.2.2.2,3.3.3.3",
          response_code: 429,
          response_body: '{"error": "Too many requests from blocked IP"}',
        });

      expectSuccess(res);
      expect(res.body.name).toBe("Updated Block");
      expect(res.body.ips).toBe("2.2.2.2,3.3.3.3");
      expect(res.body.response_code).toBe(403);
    });

    it("returns 404 for non-existent blocklist", async () => {
      const res = await request(app)
        .put("/api/ip-blocklists/99999")
        .set(authHeader(token))
        .send({ name: "Ghost", ips: "1.1.1.1" });

      expectNotFound(res);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // Associated Presets
  // ═══════════════════════════════════════════════════════════════════
  describe("GET /api/ip-blocklists/:id/associated-presets", () => {
    /**
     * Rationale: Unassigned blocklist should return empty array.
     */
    it("returns empty array for unassigned blocklist", async () => {
      const createRes = await request(app)
        .post("/api/ip-blocklists")
        .set(authHeader(token))
        .send({ name: "Assoc Test BL", ips: "3.3.3.3" });

      const res = await request(app)
        .get(`/api/ip-blocklists/${createRes.body.id}/associated-presets`)
        .set(authHeader(token));

      expectSuccess(res);
      expect(res.body.associated_presets).toEqual([]);
    });

    /**
     * Rationale: When a preset references a blocklist, the association
     * must be surfaced so the admin knows which presets would be
     * affected by changes or deletion.
     */
    it("returns associated presets when blocklist is in use", async () => {
      const blRes = await request(app)
        .post("/api/ip-blocklists")
        .set(authHeader(token))
        .send({ name: "Linked BL", ips: "4.4.4.4" });
      const blId = blRes.body.id;

      await request(app)
        .post("/api/presets")
        .set(authHeader(token))
        .send({ name: "Uses BL", ip_blocklist_id: blId });

      const res = await request(app)
        .get(`/api/ip-blocklists/${blId}/associated-presets`)
        .set(authHeader(token));

      expectSuccess(res);
      expect(res.body.associated_presets.length).toBeGreaterThanOrEqual(1);
      expect(res.body.associated_presets[0].name).toBe("Uses BL");
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // Delete
  // ═══════════════════════════════════════════════════════════════════
  describe("DELETE /api/ip-blocklists/:id", () => {
    /**
     * Rationale: Unused blocklists can be safely removed.
     */
    it("deletes an unassigned blocklist", async () => {
      const createRes = await request(app)
        .post("/api/ip-blocklists")
        .set(authHeader(token))
        .send({ name: "To Delete BL", ips: "5.5.5.5" });

      const res = await request(app)
        .delete(`/api/ip-blocklists/${createRes.body.id}`)
        .set(authHeader(token));

      expectSuccess(res);
      expect(res.body.success).toBe(true);
    });

    /**
     * Rationale: A blocklist assigned to presets cannot be deleted
     * because removal would silently disable IP blocking for those
     * presets. The controller returns a clear error with the count.
     */
    it("rejects deletion of blocklist in use by a preset", async () => {
      const blRes = await request(app)
        .post("/api/ip-blocklists")
        .set(authHeader(token))
        .send({ name: "In Use BL", ips: "6.6.6.6" });
      const blId = blRes.body.id;

      await request(app)
        .post("/api/presets")
        .set(authHeader(token))
        .send({ name: "Blocks BL Delete", ip_blocklist_id: blId });

      const res = await request(app)
        .delete(`/api/ip-blocklists/${blId}`)
        .set(authHeader(token));

      expectBadRequest(res);
    });

    it("returns 404 for non-existent blocklist", async () => {
      const res = await request(app)
        .delete("/api/ip-blocklists/99999")
        .set(authHeader(token));

      expectNotFound(res);
    });
  });
});
