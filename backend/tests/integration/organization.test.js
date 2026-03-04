/**
 * Integration tests for organization settings routes.
 *
 * Organization settings affect the entire workspace — org code (used
 * in API key prefixes) and IP logging preferences.
 *
 * Routes (from routes/organization.js):
 *   PUT  /api/organization/organization-code   (admin only)
 *   PUT  /api/organization/ip-logging           (admin only)
 */
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { createTestEnv } from "../helpers/setup.js";
import { loginAsAdmin, authHeader } from "../helpers/factories.js";
import {
  expectSuccess,
  expectValidationError,
} from "../helpers/assertions.js";

describe("Organization Integration", () => {
  let app, db, token;

  beforeAll(async () => {
    ({ app, db } = await createTestEnv());
    const admin = await loginAsAdmin(app);
    token = admin.token;
  });

  // ═══════════════════════════════════════════════════════════════════
  // Update Organization Code
  // ═══════════════════════════════════════════════════════════════════
  describe("PUT /api/organization/organization-code", () => {
    it("updates the organization code with valid format", async () => {
      const res = await request(app)
        .put("/api/organization/organization-code")
        .set(authHeader(token))
        .send({ organization_code: "abc123" });

      expectSuccess(res);
      expect(res.body.success).toBe(true);
    });

    it("rejects invalid organization code format", async () => {
      const res = await request(app)
        .put("/api/organization/organization-code")
        .set(authHeader(token))
        .send({ organization_code: "INVALID!!" });

      expectValidationError(res);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // IP Logging
  // ═══════════════════════════════════════════════════════════════════
  describe("PUT /api/organization/ip-logging", () => {
    it("enables IP logging", async () => {
      const res = await request(app)
        .put("/api/organization/ip-logging")
        .set(authHeader(token))
        .send({ log_ip_addresses: true });

      expectSuccess(res);
      expect(res.body.success).toBe(true);
    });

    it("disables IP logging", async () => {
      const res = await request(app)
        .put("/api/organization/ip-logging")
        .set(authHeader(token))
        .send({ log_ip_addresses: false });

      expectSuccess(res);
      expect(res.body.success).toBe(true);
    });

    it("rejects non-boolean value", async () => {
      const res = await request(app)
        .put("/api/organization/ip-logging")
        .set(authHeader(token))
        .send({ log_ip_addresses: "yes" });

      expectValidationError(res);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // Debug Mode
  // ═══════════════════════════════════════════════════════════════════
  describe("PUT /api/organization/debug-mode", () => {
    it("enables debug mode", async () => {
      const res = await request(app)
        .put("/api/organization/debug-mode")
        .set(authHeader(token))
        .send({ debug_mode: true });

      expectSuccess(res);
      expect(res.body.success).toBe(true);
      expect(res.body.debug_mode).toBe(true);
    });

    it("disables debug mode", async () => {
      const res = await request(app)
        .put("/api/organization/debug-mode")
        .set(authHeader(token))
        .send({ debug_mode: false });

      expectSuccess(res);
      expect(res.body.success).toBe(true);
      expect(res.body.debug_mode).toBe(false);
    });

    it("rejects non-boolean value", async () => {
      const res = await request(app)
        .put("/api/organization/debug-mode")
        .set(authHeader(token))
        .send({ debug_mode: "yes" });

      expectValidationError(res);
    });
  });
});
