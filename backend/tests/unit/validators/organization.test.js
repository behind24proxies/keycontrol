import { describe, it, expect } from "vitest";
import {
  updateOrganizationCodeSchema,
  ipLoggingSchema,
} from "../../../src/validators/organization.js";

describe("Organization Validators", () => {
  describe("updateOrganizationCodeSchema", () => {
    it("passes with valid 6-character code", () => {
      const result = updateOrganizationCodeSchema.safeParse({
        body: { organization_code: "abc123" },
      });
      expect(result.success).toBe(true);
    });

    it("rejects code shorter than 6 characters", () => {
      const result = updateOrganizationCodeSchema.safeParse({
        body: { organization_code: "abc" },
      });
      expect(result.success).toBe(false);
    });

    it("rejects code with uppercase letters", () => {
      const result = updateOrganizationCodeSchema.safeParse({
        body: { organization_code: "ABCdef" },
      });
      expect(result.success).toBe(false);
    });
  });

  describe("ipLoggingSchema", () => {
    it("passes with boolean log_ip_addresses", () => {
      const result = ipLoggingSchema.safeParse({
        body: { log_ip_addresses: true },
      });
      expect(result.success).toBe(true);
    });

    it("rejects non-boolean log_ip_addresses", () => {
      const result = ipLoggingSchema.safeParse({
        body: { log_ip_addresses: 1 },
      });
      expect(result.success).toBe(false);
    });
  });
});
