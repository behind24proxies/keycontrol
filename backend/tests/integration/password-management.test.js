/**
 * Integration tests for the password management features:
 *
 * 1. PUT  /api/organization/password   — Change password (authenticated)
 * 2. POST /api/auth/reset-password     — Reset password (public, RESET_HASH)
 * 3. GET  /api/organization/profile    — password_is_initial flag
 *
 * These tests run against a real Postgres database and verify the full
 * request→controller→service→database cycle.
 */
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { createTestEnv } from "../helpers/setup.js";
import { loginAsAdmin, authHeader } from "../helpers/factories.js";
import { ADMIN_PASSWORD } from "../helpers/constants.js";
import {
  expectSuccess,
  expectUnauthorized,
  expectBadRequest,
  expectValidationError,
} from "../helpers/assertions.js";

const RESET_HASH = "test-reset-hash-for-vitest";

describe("Password Management", () => {
  let app, db, token;

  beforeAll(async () => {
    ({ app, db } = await createTestEnv());
    const admin = await loginAsAdmin(app);
    token = admin.token;
  });

  // ═══════════════════════════════════════════════════════════════════
  // Profile — password_is_initial flag
  // ═══════════════════════════════════════════════════════════════════
  describe("GET /api/organization/profile — password_is_initial", () => {
    it("returns password_is_initial: true when password was never changed", async () => {
      const res = await request(app)
        .get("/api/organization/profile")
        .set(authHeader(token));

      expectSuccess(res);
      expect(res.body.password_is_initial).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // Change Password
  // ═══════════════════════════════════════════════════════════════════
  describe("PUT /api/organization/password", () => {
    it("rejects missing current_password", async () => {
      const res = await request(app)
        .put("/api/organization/password")
        .set(authHeader(token))
        .send({ new_password: "newpassword123" });

      expectValidationError(res);
    });

    it("rejects new_password shorter than 8 characters", async () => {
      const res = await request(app)
        .put("/api/organization/password")
        .set(authHeader(token))
        .send({ current_password: ADMIN_PASSWORD, new_password: "short" });

      expectValidationError(res);
    });

    it("rejects incorrect current password", async () => {
      const res = await request(app)
        .put("/api/organization/password")
        .set(authHeader(token))
        .send({ current_password: "wrong-password", new_password: "newpassword123" });

      expectUnauthorized(res);
    });

    it("rejects new password identical to current password", async () => {
      const res = await request(app)
        .put("/api/organization/password")
        .set(authHeader(token))
        .send({ current_password: ADMIN_PASSWORD, new_password: ADMIN_PASSWORD });

      expectBadRequest(res);
    });

    it("requires authentication", async () => {
      const res = await request(app)
        .put("/api/organization/password")
        .send({ current_password: ADMIN_PASSWORD, new_password: "newpassword123" });

      expectUnauthorized(res);
    });

    it("changes password successfully and updates password_is_initial", async () => {
      const newPassword = "brand-new-secure-password";

      // Change password
      const changeRes = await request(app)
        .put("/api/organization/password")
        .set(authHeader(token))
        .send({ current_password: ADMIN_PASSWORD, new_password: newPassword });

      expectSuccess(changeRes);
      expect(changeRes.body.success).toBe(true);
      expect(changeRes.body.message).toContain("changed");

      // Verify old password no longer works for login
      const oldLoginRes = await request(app)
        .post("/api/auth/login")
        .send({ password: ADMIN_PASSWORD });

      expect(oldLoginRes.status).toBe(401);

      // Verify new password works for login
      const newLoginRes = await request(app)
        .post("/api/auth/login")
        .send({ password: newPassword });

      expectSuccess(newLoginRes);
      expect(newLoginRes.body.token).toBeDefined();

      // password_is_initial should now be false
      expect(newLoginRes.body.password_is_initial).toBe(false);

      // Verify profile also shows password_is_initial: false
      const profileRes = await request(app)
        .get("/api/organization/profile")
        .set(authHeader(token));

      expect(profileRes.body.password_is_initial).toBe(false);

      // Restore original password for subsequent tests
      const restoreRes = await request(app)
        .put("/api/organization/password")
        .set(authHeader(token))
        .send({ current_password: newPassword, new_password: ADMIN_PASSWORD });

      expectSuccess(restoreRes);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // Reset Password
  // ═══════════════════════════════════════════════════════════════════
  describe("POST /api/auth/reset-password", () => {
    it("rejects missing reset_hash", async () => {
      const res = await request(app)
        .post("/api/auth/reset-password")
        .send({ new_password: "newpassword123" });

      expectValidationError(res);
    });

    it("rejects missing new_password", async () => {
      const res = await request(app)
        .post("/api/auth/reset-password")
        .send({ reset_hash: RESET_HASH });

      expectValidationError(res);
    });

    it("rejects new_password shorter than 8 characters", async () => {
      const res = await request(app)
        .post("/api/auth/reset-password")
        .send({ reset_hash: RESET_HASH, new_password: "short" });

      expectValidationError(res);
    });

    it("rejects an incorrect reset hash", async () => {
      const res = await request(app)
        .post("/api/auth/reset-password")
        .send({ reset_hash: "wrong-hash", new_password: "newpassword123" });

      expectUnauthorized(res);
    });

    it("resets password with valid reset hash", async () => {
      const resetPassword = "reset-password-12345";

      const res = await request(app)
        .post("/api/auth/reset-password")
        .send({ reset_hash: RESET_HASH, new_password: resetPassword });

      expectSuccess(res);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain("reset");

      // Verify the new password works
      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({ password: resetPassword });

      expectSuccess(loginRes);
      expect(loginRes.body.token).toBeDefined();

      // Restore original password via the DB directly for subsequent tests
      const bcrypt = await import("bcryptjs");
      const hash = await bcrypt.hash(ADMIN_PASSWORD, 12);
      await db.run("UPDATE organization SET admin_password_hash = $1 WHERE id = 1", [hash]);
    });

    it("rejects reuse of the same reset hash (one-time use)", async () => {
      // The previous test already used RESET_HASH, so it should be rejected
      const res = await request(app)
        .post("/api/auth/reset-password")
        .send({ reset_hash: RESET_HASH, new_password: "anotherpassword1" });

      expectBadRequest(res);
      expect(res.body.error).toContain("already been used");
    });
  });
});
