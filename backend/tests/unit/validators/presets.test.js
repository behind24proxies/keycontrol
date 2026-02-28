/**
 * Unit tests for preset validators.
 *
 * Presets encapsulate reusable permission bundles (rate limits, IP lists,
 * endpoint access). Correct validation prevents incoherent configurations.
 */
import { describe, it, expect } from "vitest";
import {
  createPresetSchema,
  updatePresetSchema,
  batchUpdatePresetsSchema,
  duplicatePresetSchema,
  deletePresetSchema,
} from "../../../src/validators/presets.js";

describe("Preset Validators", () => {
  // ═══════════════════════════════════════════════════════════════════
  // createPresetSchema
  // ═══════════════════════════════════════════════════════════════════
  describe("createPresetSchema", () => {
    const validPayload = {
      body: {
        name: "Standard Access",
      },
    };

    /**
     * Rationale: Name is the only truly required field for creating a preset.
     * All other fields are optional with sensible defaults.
     */
    it("passes with just a name (minimal payload)", () => {
      const result = createPresetSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    /**
     * Rationale: Empty name would create an unlabelled preset that
     * admins couldn't identify in the UI.
     */
    it("rejects empty name", () => {
      const result = createPresetSchema.safeParse({
        body: { name: "" },
      });
      expect(result.success).toBe(false);
    });

    /**
     * Rationale: Name has a max length of 100 to prevent UI overflow.
     */
    it("rejects name exceeding 100 characters", () => {
      const result = createPresetSchema.safeParse({
        body: { name: "a".repeat(101) },
      });
      expect(result.success).toBe(false);
    });

    /**
     * Rationale: Presets can reference rate limits, IP lists, and endpoint
     * groups. Validate that all optional FK fields accept positive integers.
     */
    it("passes with all optional fields populated", () => {
      const result = createPresetSchema.safeParse({
        body: {
          name: "Full Preset",
          description: "A complete preset",
          rate_limit_id: 1,
          ip_allowlist_id: 2,
          ip_blocklist_id: null,
          endpoint_group_ids: [1, 2],
          resource_ids: [1],
          endpoint_group_settings: {
            1: { usage_limit: 1000, lease_seconds: 3600 },
          },
        },
      });
      expect(result.success).toBe(true);
    });

    /**
     * Rationale: FK IDs must be positive integers. Zero or negative
     * values indicate invalid references.
     */
    it("rejects non-positive rate_limit_id", () => {
      const result = createPresetSchema.safeParse({
        body: { name: "Bad", rate_limit_id: 0 },
      });
      expect(result.success).toBe(false);
    });

    /**
     * Rationale: Defaults for arrays should be empty arrays, not undefined,
     * to avoid null-pointer issues downstream.
     */
    it("defaults endpoint_group_ids and resource_ids to empty arrays", () => {
      const result = createPresetSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
      expect(result.data.body.endpoint_group_ids).toEqual([]);
      expect(result.data.body.resource_ids).toEqual([]);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // updatePresetSchema
  // ═══════════════════════════════════════════════════════════════════
  describe("updatePresetSchema", () => {
    /**
     * Rationale: Update requires params.id to identify which preset.
     */
    it("passes with valid params and body", () => {
      const result = updatePresetSchema.safeParse({
        params: { id: "1" },
        body: { name: "Updated Preset" },
      });
      expect(result.success).toBe(true);
    });

    /**
     * Rationale: All body fields on update are optional — partial updates
     * are supported.
     */
    it("passes with empty body (no updates)", () => {
      const result = updatePresetSchema.safeParse({
        params: { id: "1" },
        body: {},
      });
      expect(result.success).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // batchUpdatePresetsSchema
  // ═══════════════════════════════════════════════════════════════════
  describe("batchUpdatePresetsSchema", () => {
    /**
     * Rationale: Batch update requires at least one preset ID.
     * An empty array would be a no-op that wastes a round-trip.
     */
    it("rejects empty preset_ids array", () => {
      const result = batchUpdatePresetsSchema.safeParse({
        body: { preset_ids: [] },
      });
      expect(result.success).toBe(false);
    });

    /**
     * Rationale: Happy path for batch update — at least one preset,
     * with optional project/endpoint group assignments.
     */
    it("passes with valid preset_ids and optional fields", () => {
      const result = batchUpdatePresetsSchema.safeParse({
        body: {
          preset_ids: [1, 2, 3],
          resource_ids: [1],
          endpoint_group_ids: [1, 2],
        },
      });
      expect(result.success).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // duplicatePresetSchema / deletePresetSchema
  // ═══════════════════════════════════════════════════════════════════
  describe("duplicatePresetSchema", () => {
    /**
     * Rationale: Only requires the preset ID in params to duplicate.
     */
    it("passes with valid params", () => {
      const result = duplicatePresetSchema.safeParse({
        params: { id: "5" },
      });
      expect(result.success).toBe(true);
    });
  });

  describe("deletePresetSchema", () => {
    /**
     * Rationale: Only requires the preset ID in params to delete.
     */
    it("passes with valid params", () => {
      const result = deletePresetSchema.safeParse({
        params: { id: "5" },
      });
      expect(result.success).toBe(true);
    });
  });
});
