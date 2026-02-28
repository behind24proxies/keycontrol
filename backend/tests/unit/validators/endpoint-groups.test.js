/**
 * Unit tests for endpoint group Zod validators.
 *
 * Validates the create and update schemas for endpoint groups,
 * including name requirement, optional description, and endpoints array.
 */
import { describe, it, expect } from "vitest";
import {
  createEndpointGroupSchema,
  updateEndpointGroupSchema,
} from "../../../src/validators/endpoint-groups.js";

// ── Helpers ──────────────────────────────────────────────────────────
const valid = (schema, data) => schema.safeParse(data);

// ═══════════════════════════════════════════════════════════════════════
// createEndpointGroupSchema
// ═══════════════════════════════════════════════════════════════════════
describe("createEndpointGroupSchema", () => {
  const parse = (params, body) =>
    valid(createEndpointGroupSchema, { params, body });

  /** Rationale: Minimum valid payload — just a name and resourceId. */
  it("accepts valid payload with name only", () => {
    const r = parse({ resourceId: "1" }, { name: "Auth Endpoints" });
    expect(r.success).toBe(true);
  });

  /** Rationale: Endpoints array with all required fields should pass. */
  it("accepts payload with endpoints", () => {
    const r = parse(
      { resourceId: "1" },
      {
        name: "Auth Endpoints",
        endpoints: [{ url_pattern: "/api/auth/*", method: "POST" }],
      },
    );
    expect(r.success).toBe(true);
    expect(r.data.body.endpoints).toHaveLength(1);
  });

  /** Rationale: Name is required — empty string should fail. */
  it("rejects empty name", () => {
    const r = parse({ resourceId: "1" }, { name: "" });
    expect(r.success).toBe(false);
  });

  /** Rationale: Missing name entirely should fail. */
  it("rejects missing name", () => {
    const r = parse({ resourceId: "1" }, {});
    expect(r.success).toBe(false);
  });

  /** Rationale: resourceId is required in params. */
  it("rejects missing resourceId", () => {
    const r = parse({}, { name: "Test" });
    expect(r.success).toBe(false);
  });

  /** Rationale: Endpoints with missing url_pattern should fail. */
  it("rejects endpoint without url_pattern", () => {
    const r = parse(
      { resourceId: "1" },
      { name: "Test", endpoints: [{ method: "GET" }] },
    );
    expect(r.success).toBe(false);
  });

  /** Rationale: Endpoints with missing method should fail. */
  it("rejects endpoint without method", () => {
    const r = parse(
      { resourceId: "1" },
      { name: "Test", endpoints: [{ url_pattern: "/api/*" }] },
    );
    expect(r.success).toBe(false);
  });

  /** Rationale: When endpoints is omitted it should default to []. */
  it("defaults endpoints to empty array", () => {
    const r = parse({ resourceId: "1" }, { name: "Test" });
    expect(r.success).toBe(true);
    expect(r.data.body.endpoints).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// updateEndpointGroupSchema
// ═══════════════════════════════════════════════════════════════════════
describe("updateEndpointGroupSchema", () => {
  const parse = (params, body) =>
    valid(updateEndpointGroupSchema, { params, body });

  /** Rationale: Valid update with new name. */
  it("accepts valid update payload", () => {
    const r = parse({ id: "1" }, { name: "Updated Group" });
    expect(r.success).toBe(true);
  });

  /** Rationale: id param is required for updates. */
  it("rejects missing id param", () => {
    const r = parse({}, { name: "Updated" });
    expect(r.success).toBe(false);
  });

  /** Rationale: Empty name is not allowed on update either. */
  it("rejects empty name on update", () => {
    const r = parse({ id: "1" }, { name: "" });
    expect(r.success).toBe(false);
  });
});
