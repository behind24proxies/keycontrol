/**
 * Integration tests for the auth rate limiter.
 *
 * Verifies that the in-memory rate limiter kicks in after 5 failed
 * login or reset attempts within the 15-minute window.
 *
 * NOTE: These tests hit the rate limiter from the *same* IP (127.0.0.1
 * via supertest). We send 5 bad attempts then assert the 6th is blocked.
 */
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { createTestEnv } from "../helpers/setup.js";
import { ADMIN_PASSWORD } from "../helpers/constants.js";
import { loginAsAdmin, authHeader } from "../helpers/factories.js";

describe("Auth Rate Limiting", () => {
  let app, token;

  beforeAll(async () => {
    let db;
    ({ app, db } = await createTestEnv());
    const admin = await loginAsAdmin(app);
    token = admin.token;
  });

  describe("POST /api/auth/login — rate limiting", () => {
    it("returns 429 after 5 failed login attempts", async () => {
      // Burn through the 5 allowed failures
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post("/api/auth/login")
          .send({ password: "wrong-password" });
      }

      // 6th attempt should be rate-limited
      const res = await request(app)
        .post("/api/auth/login")
        .send({ password: "wrong-password" });

      expect(res.status).toBe(429);
      expect(res.body.code).toBe("TOO_MANY_REQUESTS");
      expect(res.body.error).toContain("Too many");
    });

    it("also blocks valid credentials when rate-limited", async () => {
      // Even a correct password should be blocked at this point
      const res = await request(app)
        .post("/api/auth/login")
        .send({ password: ADMIN_PASSWORD });

      expect(res.status).toBe(429);
    });
  });

  describe("POST /api/auth/reset-password — rate limiting", () => {
    /**
     * NOTE: Since supertest uses the same IP for all requests and the
     * login rate limiter already exhausted the quota above, the reset
     * endpoint will also be rate-limited from the same IP. This validates
     * that rate limiting applies cross-endpoint per IP.
     */
    it("returns 429 when IP is already rate-limited from login failures", async () => {
      const res = await request(app)
        .post("/api/auth/reset-password")
        .send({ reset_hash: "anything", new_password: "newpassword1" });

      expect(res.status).toBe(429);
    });
  });
});
