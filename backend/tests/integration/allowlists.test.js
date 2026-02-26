/**
 * Integration tests for IP allowlist routes.
 *
 * IP allowlists restrict API access to specific IP addresses or CIDR ranges.
 * They can be assigned to presets and cannot be deleted while in use.
 *
 * Routes:
 *   GET    /api/ip-allowlists
 *   POST   /api/ip-allowlists
 *   PUT    /api/ip-allowlists/:id
 *   GET    /api/ip-allowlists/:id/associated-presets
 *   DELETE /api/ip-allowlists/:id
 *
 * Response shapes:
 *   - list   → 200 flat array (each with .usage)
 *   - create → 201 { id, name, ips, response_code, ... }
 *   - update → 200 { id, name, ips, ... }
 *   - associatedPresets → 200 { associated_presets: [...] }
 *   - delete → 200 { success: true }
 */
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { createTestEnv } from "../helpers/setup.js";
import { loginAsAdmin, seedPreset, authHeader } from "../helpers/factories.js";
import {
  expectSuccess,
  expectValidationError,
  expectNotFound,
  expectBadRequest,
} from "../helpers/assertions.js";

describe("IP Allowlists Integration", () => {
  let app, db, token;

  beforeAll(async () => {
    ({ app, db } = await createTestEnv());
    const admin = await loginAsAdmin(app);
    token = admin.token;
  });

  // ═══════════════════════════════════════════════════════════════════
  // Create
  // ═══════════════════════════════════════════════════════════════════
  describe("POST /api/ip-allowlists", () => {
    /**
     * Rationale: The minimum payload for an allowlist is name + ips.
     * Response defaults should be applied (code 403, type json).
     */
    it("creates an allowlist with name and IPs", async () => {
      const res = await request(app)
        .post("/api/ip-allowlists")
        .set(authHeader(token))
        .send({ name: "Office IPs", ips: "10.0.0.1,10.0.0.2" });

      expectSuccess(res, 201);
      expect(res.body.id).toBeDefined();
      expect(res.body.name).toBe("Office IPs");
      expect(res.body.ips).toBe("10.0.0.1,10.0.0.2");
      expect(res.body.response_code).toBe(403);
    });

    /**
     * Rationale: CIDR notation is a valid format for IP ranges.
     * The system should accept CIDR as part of the ips string
     * without any special parsing at creation time.
     */
    it("creates an allowlist with CIDR notation", async () => {
      const res = await request(app)
        .post("/api/ip-allowlists")
        .set(authHeader(token))
        .send({ name: "Subnet Allow", ips: "192.168.0.0/16" });

      expectSuccess(res, 201);
      expect(res.body.ips).toBe("192.168.0.0/16");
    });

    /**
     * Rationale: response_code (403) and response_type ("json") are
     * system-locked. Even when explicitly sent, they are overridden.
     * Only the response_body is user-configurable.
     */
    it("ignores custom response_code and locks to 403", async () => {
      const res = await request(app)
        .post("/api/ip-allowlists")
        .set(authHeader(token))
        .send({
          name: "Custom Response AL",
          ips: "1.2.3.4",
          response_code: 401,
          response_body: '{"error": "Unauthorized IP"}',
          response_type: "json",
        });

      expectSuccess(res, 201);
      expect(res.body.response_code).toBe(403);
      expect(res.body.response_body).toBe('{"error": "Unauthorized IP"}');
    });

    /**
     * Rationale: Duplicate names create ambiguity when assigning
     * allowlists to presets. The unique index enforces this.
     */
    it("rejects duplicate name", async () => {
      await request(app)
        .post("/api/ip-allowlists")
        .set(authHeader(token))
        .send({ name: "Dup Allow", ips: "1.1.1.1" });

      const res = await request(app)
        .post("/api/ip-allowlists")
        .set(authHeader(token))
        .send({ name: "Dup Allow", ips: "2.2.2.2" });

      expect(res.status).toBe(409);
    });

    /**
     * Rationale: Both name and ips are required. The validator should
     * reject payloads missing either field with a clear error.
     */
    it("rejects missing name", async () => {
      const res = await request(app)
        .post("/api/ip-allowlists")
        .set(authHeader(token))
        .send({ ips: "1.2.3.4" });

      expectValidationError(res);
    });

    it("rejects missing ips", async () => {
      const res = await request(app)
        .post("/api/ip-allowlists")
        .set(authHeader(token))
        .send({ name: "No IPs" });

      expectValidationError(res);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // List
  // ═══════════════════════════════════════════════════════════════════
  describe("GET /api/ip-allowlists", () => {
    /**
     * Rationale: The list endpoint enriches each allowlist with usage
     * info (preset_count, preset_names) so the UI can show whether
     * an allowlist is in use before the admin tries to delete it.
     */
    it("lists allowlists with usage information", async () => {
      const res = await request(app)
        .get("/api/ip-allowlists")
        .set(authHeader(token));

      expectSuccess(res);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);

      // Every entry should have usage metadata
      const entry = res.body[0];
      expect(entry).toHaveProperty("usage");
      expect(entry.usage).toHaveProperty("preset_count");
      expect(entry.usage).toHaveProperty("preset_names");
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // Update
  // ═══════════════════════════════════════════════════════════════════
  describe("PUT /api/ip-allowlists/:id", () => {
    /**
     * Rationale: Updating an allowlist replaces its name, IPs, and
     * response config. This is important when IP ranges change
     * (e.g., office moves, new VPN endpoints).
     */
    it("updates an allowlist name and IPs", async () => {
      const createRes = await request(app)
        .post("/api/ip-allowlists")
        .set(authHeader(token))
        .send({ name: "To Update Allow", ips: "1.1.1.1" });

      const res = await request(app)
        .put(`/api/ip-allowlists/${createRes.body.id}`)
        .set(authHeader(token))
        .send({ name: "Updated Allow", ips: "2.2.2.2,3.3.3.3" });

      expectSuccess(res);
      expect(res.body.name).toBe("Updated Allow");
      expect(res.body.ips).toBe("2.2.2.2,3.3.3.3");
    });

    /**
     * Rationale: Non-existent IDs must 404.
     */
    it("returns 404 for non-existent allowlist", async () => {
      const res = await request(app)
        .put("/api/ip-allowlists/99999")
        .set(authHeader(token))
        .send({ name: "Ghost", ips: "1.1.1.1" });

      expectNotFound(res);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // Associated Presets
  // ═══════════════════════════════════════════════════════════════════
  describe("GET /api/ip-allowlists/:id/associated-presets", () => {
    /**
     * Rationale: A new allowlist not assigned to any preset should
     * return an empty associated presets array.
     */
    it("returns empty array for unassigned allowlist", async () => {
      const createRes = await request(app)
        .post("/api/ip-allowlists")
        .set(authHeader(token))
        .send({ name: "Assoc Test AL", ips: "3.3.3.3" });

      const res = await request(app)
        .get(`/api/ip-allowlists/${createRes.body.id}/associated-presets`)
        .set(authHeader(token));

      expectSuccess(res);
      expect(res.body.associated_presets).toEqual([]);
    });

    /**
     * Rationale: When a preset references an allowlist, the associated
     * presets endpoint must surface this relationship, enabling the
     * UI to warn admins before deletion.
     */
    it("returns associated presets when allowlist is in use", async () => {
      // Create an allowlist and a preset that references it
      const alRes = await request(app)
        .post("/api/ip-allowlists")
        .set(authHeader(token))
        .send({ name: "Linked AL", ips: "4.4.4.4" });
      const alId = alRes.body.id;

      await request(app)
        .post("/api/presets")
        .set(authHeader(token))
        .send({ name: "Uses AL", ip_allowlist_id: alId });

      const res = await request(app)
        .get(`/api/ip-allowlists/${alId}/associated-presets`)
        .set(authHeader(token));

      expectSuccess(res);
      expect(res.body.associated_presets.length).toBeGreaterThanOrEqual(1);
      expect(res.body.associated_presets[0].name).toBe("Uses AL");
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // Delete
  // ═══════════════════════════════════════════════════════════════════
  describe("DELETE /api/ip-allowlists/:id", () => {
    /**
     * Rationale: An unused allowlist can be safely deleted.
     */
    it("deletes an unassigned allowlist", async () => {
      const createRes = await request(app)
        .post("/api/ip-allowlists")
        .set(authHeader(token))
        .send({ name: "To Delete AL", ips: "5.5.5.5" });

      const res = await request(app)
        .delete(`/api/ip-allowlists/${createRes.body.id}`)
        .set(authHeader(token));

      expectSuccess(res);
      expect(res.body.success).toBe(true);
    });

    /**
     * Rationale: Deleting an allowlist currently assigned to a preset
     * would break that preset's IP filtering. The controller must
     * reject deletion with a clear error explaining the dependency.
     */
    it("rejects deletion of allowlist in use by a preset", async () => {
      const alRes = await request(app)
        .post("/api/ip-allowlists")
        .set(authHeader(token))
        .send({ name: "In Use AL", ips: "6.6.6.6" });
      const alId = alRes.body.id;

      await request(app)
        .post("/api/presets")
        .set(authHeader(token))
        .send({ name: "Blocks AL Delete", ip_allowlist_id: alId });

      const res = await request(app)
        .delete(`/api/ip-allowlists/${alId}`)
        .set(authHeader(token));

      expectBadRequest(res);
    });

    /**
     * Rationale: Non-existent IDs must return 404.
     */
    it("returns 404 for non-existent allowlist", async () => {
      const res = await request(app)
        .delete("/api/ip-allowlists/99999")
        .set(authHeader(token));

      expectNotFound(res);
    });
  });
});
