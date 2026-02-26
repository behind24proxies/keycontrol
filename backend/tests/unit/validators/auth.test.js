import { describe, it, expect } from "vitest";
import { loginSchema } from "../../../src/validators/auth.js";

describe("Auth Validators", () => {
  describe("loginSchema", () => {
    it("passes with valid token", () => {
      const result = loginSchema.safeParse({
        body: { token: "my-admin-token" },
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty token", () => {
      const result = loginSchema.safeParse({
        body: { token: "" },
      });
      expect(result.success).toBe(false);
    });

    it("rejects missing token", () => {
      const result = loginSchema.safeParse({
        body: {},
      });
      expect(result.success).toBe(false);
    });
  });
});
