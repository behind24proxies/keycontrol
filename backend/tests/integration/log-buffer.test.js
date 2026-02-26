/**
 * Integration tests for the log buffer / request logs routes.
 *
 * Request logs are written by the gateway and read by the admin dashboard.
 *
 * Response shapes from the controller:
 *   - list → 200 { logs: [...], pagination }
 */
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { createTestEnv } from "../helpers/setup.js";
import { loginAsAdmin, authHeader } from "../helpers/factories.js";
import { expectSuccess, expectUnauthorized } from "../helpers/assertions.js";

describe("Log Buffer Integration", () => {
  let app, db, token;

  beforeAll(async () => {
    ({ app, db } = await createTestEnv());
    const admin = await loginAsAdmin(app);
    token = admin.token;
  });

  // ═══════════════════════════════════════════════════════════════════
  // List Logs
  // ═══════════════════════════════════════════════════════════════════
  describe("GET /api/logs", () => {
    /**
     * Rationale: The logs endpoint must return { logs: [...] }.
     * An empty array is valid when no gateway requests have been processed.
     */
    it("returns an array of logs (may be empty)", async () => {
      const res = await request(app)
        .get("/api/logs")
        .set(authHeader(token));

      expectSuccess(res);
      expect(Array.isArray(res.body.logs)).toBe(true);
    });

    /**
     * Rationale: Logs contain sensitive API usage data; unauthenticated
     * access must be blocked.
     */
    it("rejects unauthenticated requests", async () => {
      const res = await request(app).get("/api/logs");

      expectUnauthorized(res);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // Log Settings
  // ═══════════════════════════════════════════════════════════════════
  describe("GET /api/logs/settings", () => {
    /**
     * Rationale: Log settings endpoint returns the current IP logging
     * preference as a boolean.
     */
    it("returns log settings", async () => {
      const res = await request(app)
        .get("/api/logs/settings")
        .set(authHeader(token));

      expectSuccess(res);
      expect(typeof res.body.log_ip_addresses).toBe("boolean");
    });
  });

  describe("PUT /api/logs/settings", () => {
    /**
     * Rationale: Updating log settings toggles IP address logging.
     */
    it("enables IP logging via settings", async () => {
      const res = await request(app)
        .put("/api/logs/settings")
        .set(authHeader(token))
        .send({ log_ip_addresses: true });

      expectSuccess(res);
      expect(res.body.success).toBe(true);
      expect(res.body.log_ip_addresses).toBe(true);
    });

    it("disables IP logging via settings", async () => {
      const res = await request(app)
        .put("/api/logs/settings")
        .set(authHeader(token))
        .send({ log_ip_addresses: false });

      expectSuccess(res);
      expect(res.body.success).toBe(true);
      expect(res.body.log_ip_addresses).toBe(false);
    });
  });
});
