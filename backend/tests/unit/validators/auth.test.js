import { describe, it, expect } from "vitest";
import { loginSchema, loginVerify2FASchema, resetPasswordSchema } from "../../../src/validators/auth.js";

describe("Auth Validators", () => {
  describe("loginSchema", () => {
    it("passes with valid password", () => {
      const result = loginSchema.safeParse({
        body: { password: "my-admin-password" },
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty password", () => {
      const result = loginSchema.safeParse({
        body: { password: "" },
      });
      expect(result.success).toBe(false);
    });

    it("rejects missing password", () => {
      const result = loginSchema.safeParse({
        body: {},
      });
      expect(result.success).toBe(false);
    });
  });

  describe("loginVerify2FASchema", () => {
    it("passes with valid password and 6-digit totp_code", () => {
      const result = loginVerify2FASchema.safeParse({
        body: { password: "my-password", totp_code: "123456" },
      });
      expect(result.success).toBe(true);
    });

    it("rejects missing totp_code", () => {
      const result = loginVerify2FASchema.safeParse({
        body: { password: "my-password" },
      });
      expect(result.success).toBe(false);
    });

    it("rejects totp_code that is not 6 digits", () => {
      const result = loginVerify2FASchema.safeParse({
        body: { password: "my-password", totp_code: "12345" },
      });
      expect(result.success).toBe(false);
    });
  });

  describe("resetPasswordSchema", () => {
    it("passes with valid reset_hash and new_password", () => {
      const result = resetPasswordSchema.safeParse({
        body: { reset_hash: "some-hash", new_password: "12345678" },
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty reset_hash", () => {
      const result = resetPasswordSchema.safeParse({
        body: { reset_hash: "", new_password: "12345678" },
      });
      expect(result.success).toBe(false);
    });

    it("rejects new_password shorter than 8 chars", () => {
      const result = resetPasswordSchema.safeParse({
        body: { reset_hash: "hash", new_password: "short" },
      });
      expect(result.success).toBe(false);
    });

    it("rejects missing fields", () => {
      const result = resetPasswordSchema.safeParse({
        body: {},
      });
      expect(result.success).toBe(false);
    });
  });
});
