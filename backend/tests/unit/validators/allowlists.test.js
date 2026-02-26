/**
 * Unit tests for IP allowlist Zod validators.
 *
 * Covers the create and update schemas with name, IPs, response config.
 */
import { describe, it, expect } from "vitest";
import {
  createAllowlistSchema,
  updateAllowlistSchema,
} from "../../../src/validators/allowlists.js";

const valid = (schema, data) => schema.safeParse(data);

// ═══════════════════════════════════════════════════════════════════════
// createAllowlistSchema
// ═══════════════════════════════════════════════════════════════════════
describe("createAllowlistSchema", () => {
  const parse = (body) => valid(createAllowlistSchema, { body });

  /** Rationale: Minimum valid payload — name + ips. */
  it("accepts valid create payload", () => {
    const r = parse({ name: "Office IPs", ips: "10.0.0.1,10.0.0.2" });
    expect(r.success).toBe(true);
  });

  /** Rationale: response_body defaults. response_code/type are controller-locked. */
  it("applies default response_body", () => {
    const r = parse({ name: "Test", ips: "1.2.3.4" });
    expect(r.success).toBe(true);
    expect(r.data.body.response_body).toBe('{"error": "IP not allowed"}');
  });

  /** Rationale: Name is required — reject empty. */
  it("rejects empty name", () => {
    const r = parse({ name: "", ips: "1.2.3.4" });
    expect(r.success).toBe(false);
  });

  /** Rationale: IPs are required — reject empty. */
  it("rejects empty ips", () => {
    const r = parse({ name: "Test", ips: "" });
    expect(r.success).toBe(false);
  });

  /** Rationale: response_type is z.any() — validator passes anything, controller overrides. */
  it("accepts any response_type (controller locks it)", () => {
    const r = parse({
      name: "Test",
      ips: "1.2.3.4",
      response_type: "html",
    });
    expect(r.success).toBe(true);
  });

  /** Rationale: accepts xml (and any other value). */
  it("accepts xml response_type", () => {
    const r = parse({
      name: "Test",
      ips: "1.2.3.4",
      response_type: "xml",
    });
    expect(r.success).toBe(true);
  });

  /** Rationale: Missing ips field entirely should fail. */
  it("rejects missing ips field", () => {
    const r = parse({ name: "Test" });
    expect(r.success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// updateAllowlistSchema
// ═══════════════════════════════════════════════════════════════════════
describe("updateAllowlistSchema", () => {
  const parse = (params, body) =>
    valid(updateAllowlistSchema, { params, body });

  /** Rationale: Valid update with all fields. */
  it("accepts valid update payload", () => {
    const r = parse(
      { id: "1" },
      { name: "Updated", ips: "10.0.0.0/8" },
    );
    expect(r.success).toBe(true);
  });

  /** Rationale: id param is required. */
  it("rejects missing id param", () => {
    const r = parse({}, { name: "Updated", ips: "10.0.0.1" });
    expect(r.success).toBe(false);
  });
});
