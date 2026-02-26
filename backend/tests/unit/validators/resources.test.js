/**
 * Unit tests for resource validators (createResourceSchema, updateResourceSchema).
 *
 * Validates the Zod schemas in isolation. Resources are the top-level entity
 * in the system, so correct validation is essential.
 */
import { describe, it, expect } from "vitest";
import {
  createResourceSchema,
  updateResourceSchema,
} from "../../../src/validators/resources.js";

describe("Resource Validators", () => {
  // ═══════════════════════════════════════════════════════════════════
  // createResourceSchema
  // ═══════════════════════════════════════════════════════════════════
  describe("createResourceSchema", () => {
    const validPayload = {
      body: {
        name: "Test Resource",
        unique_path: "test-resource",
        secret_api_key: "sk-test",
        external_api_url: "https://api.example.com",
      },
    };

    /**
     * Rationale: Happy path — the minimum viable payload for creating
     * a resource. If this fails, no resources can be created.
     */
    it("passes with all required fields", () => {
      const result = createResourceSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    /**
     * Rationale: Resources must have a name for display in the UI.
     * An empty name would create a confusing entry.
     */
    it("fails without name", () => {
      const { name, ...rest } = validPayload.body;
      const result = createResourceSchema.safeParse({ body: rest });
      expect(result.success).toBe(false);
    });

    /**
     * Rationale: unique_path is used in gateway URLs. Missing it would
     * break routing entirely.
     */
    it("fails without unique_path", () => {
      const { unique_path, ...rest } = validPayload.body;
      const result = createResourceSchema.safeParse({ body: rest });
      expect(result.success).toBe(false);
    });

    /**
     * Rationale: The schema supports optional fields like description
     * and timeout_seconds for advanced configuration.
     */
    it("passes with optional fields included", () => {
      const result = createResourceSchema.safeParse({
        body: {
          ...validPayload.body,
          description: "A test resource",
          timeout_seconds: 30,
        },
      });
      expect(result.success).toBe(true);
    });

    /**
     * Rationale: Either external_api_base_url or external_api_url must
     * be provided — the refine rule ensures at least one exists.
     */
    it("fails without any external API URL", () => {
      const { external_api_url, ...rest } = validPayload.body;
      const result = createResourceSchema.safeParse({ body: rest });
      expect(result.success).toBe(false);
    });

    /**
     * Rationale: external_api_base_url is an alternative to external_api_url,
     * allowing more flexible URL construction.
     */
    it("passes with external_api_base_url instead of external_api_url", () => {
      const { external_api_url, ...rest } = validPayload.body;
      const result = createResourceSchema.safeParse({
        body: { ...rest, external_api_base_url: "https://base.example.com" },
      });
      expect(result.success).toBe(true);
    });

    /**
     * Rationale: timeout_seconds must be a positive integer if provided.
     * Zero or negative values are illogical for a timeout.
     */
    it("rejects non-positive timeout_seconds", () => {
      const result = createResourceSchema.safeParse({
        body: { ...validPayload.body, timeout_seconds: 0 },
      });
      expect(result.success).toBe(false);
    });

    /**
     * Rationale: Default timeout response values should be applied by
     * the schema when not explicitly specified.
     */
    it("applies default timeout response values", () => {
      const result = createResourceSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
      // The refine wraps the output, so defaults apply at the body level
      expect(result.data.body.timeout_response_code).toBe(504);
      expect(result.data.body.timeout_response_type).toBe("json");
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // updateResourceSchema
  // ═══════════════════════════════════════════════════════════════════
  describe("updateResourceSchema", () => {
    /**
     * Rationale: Updates require a params.id plus the body fields.
     */
    it("passes with valid params and body", () => {
      const result = updateResourceSchema.safeParse({
        params: { id: "1" },
        body: {
          name: "Updated",
          secret_api_key: "sk-updated",
          external_api_url: "https://api.example.com",
        },
      });
      expect(result.success).toBe(true);
    });

    /**
     * Rationale: Name is required even on updates — ensures the resource
     * always has a displayable name.
     */
    it("fails without name in body", () => {
      const result = updateResourceSchema.safeParse({
        params: { id: "1" },
        body: { secret_api_key: "sk-test" },
      });
      expect(result.success).toBe(false);
    });
  });
});
