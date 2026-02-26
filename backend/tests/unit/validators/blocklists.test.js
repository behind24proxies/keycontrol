/**
 * Unit tests for IP blocklist Zod validators.
 *
 * Mirrors allowlist validators — name, IPs, response config.
 */
import { describe, it, expect } from "vitest";
import {
  createBlocklistSchema,
  updateBlocklistSchema,
} from "../../../src/validators/blocklists.js";

const valid = (schema, data) => schema.safeParse(data);

// ═══════════════════════════════════════════════════════════════════════
// createBlocklistSchema
// ═══════════════════════════════════════════════════════════════════════
describe("createBlocklistSchema", () => {
  const parse = (body) => valid(createBlocklistSchema, { body });

  /** Rationale: Minimum valid payload — name + ips. */
  it("accepts valid create payload", () => {
    const r = parse({ name: "Bad Actors", ips: "192.168.1.100" });
    expect(r.success).toBe(true);
  });

  /** Rationale: response_body defaults. response_code/type are controller-locked. */
  it("applies default response_body", () => {
    const r = parse({ name: "Test", ips: "1.2.3.4" });
    expect(r.success).toBe(true);
    expect(r.data.body.response_body).toBe('{"error": "IP blocked"}');
  });

  /** Rationale: Name is required. */
  it("rejects empty name", () => {
    const r = parse({ name: "", ips: "1.2.3.4" });
    expect(r.success).toBe(false);
  });

  /** Rationale: IPs are required. */
  it("rejects empty ips", () => {
    const r = parse({ name: "Test", ips: "" });
    expect(r.success).toBe(false);
  });

  /** Rationale: response_type is z.any() — validator passes anything, controller overrides. */
  it("accepts any response_type (controller locks it)", () => {
    const r = parse({
      name: "Test",
      ips: "1.2.3.4",
      response_type: "yaml",
    });
    expect(r.success).toBe(true);
  });

  /** Rationale: text is accepted (any value is). */
  it("accepts text response_type", () => {
    const r = parse({
      name: "Test",
      ips: "1.2.3.4",
      response_type: "text",
    });
    expect(r.success).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// updateBlocklistSchema
// ═══════════════════════════════════════════════════════════════════════
describe("updateBlocklistSchema", () => {
  const parse = (params, body) =>
    valid(updateBlocklistSchema, { params, body });

  /** Rationale: Valid update payload. */
  it("accepts valid update payload", () => {
    const r = parse(
      { id: "1" },
      { name: "Updated Block", ips: "10.0.0.0/8" },
    );
    expect(r.success).toBe(true);
  });

  /** Rationale: id param required. */
  it("rejects missing id param", () => {
    const r = parse({}, { name: "Updated", ips: "10.0.0.1" });
    expect(r.success).toBe(false);
  });
});
