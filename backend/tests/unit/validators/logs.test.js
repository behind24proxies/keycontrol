/**
 * Unit tests for logs Zod validator.
 *
 * Covers the getLogsSchema query parameter validation
 * and updateLogSettingsSchema body validation.
 */
import { describe, it, expect } from "vitest";
import { getLogsSchema, updateLogSettingsSchema } from "../../../src/validators/logs.js";

const valid = (data) => getLogsSchema.safeParse(data);

describe("getLogsSchema", () => {
  const parse = (query) => valid({ query });

  /** Rationale: All query params are optional — empty object is valid. */
  it("accepts empty query", () => {
    const r = parse({});
    expect(r.success).toBe(true);
  });

  /** Rationale: Defaults page to "1" and per_page to "50". */
  it("applies pagination defaults", () => {
    const r = parse({});
    expect(r.success).toBe(true);
    expect(r.data.query.page).toBe("1");
    expect(r.data.query.per_page).toBe("50");
  });

  /** Rationale: Filter by resource_id should pass through. */
  it("accepts resource_id filter", () => {
    const r = parse({ resource_id: "5" });
    expect(r.success).toBe(true);
    expect(r.data.query.resource_id).toBe("5");
  });

  /** Rationale: Multiple filter params should all pass. */
  it("accepts multiple filter params", () => {
    const r = parse({
      resource_id: "1",
      method: "GET",
      status_code: "200",
      date_from: "2025-01-01",
      date_to: "2025-12-31",
    });
    expect(r.success).toBe(true);
  });

  /** Rationale: Custom pagination values should override defaults. */
  it("accepts custom pagination", () => {
    const r = parse({ page: "3", per_page: "100" });
    expect(r.success).toBe(true);
    expect(r.data.query.page).toBe("3");
    expect(r.data.query.per_page).toBe("100");
  });

  /** Rationale: api_key_id is a valid filter for scoping logs. */
  it("accepts api_key_id filter", () => {
    const r = parse({ api_key_id: "10" });
    expect(r.success).toBe(true);
    expect(r.data.query.api_key_id).toBe("10");
  });
});

describe("updateLogSettingsSchema", () => {
  const parse = (body) => updateLogSettingsSchema.safeParse({ body });

  /** Rationale: Both fields are optional — empty body is valid. */
  it("accepts empty body", () => {
    const r = parse({});
    expect(r.success).toBe(true);
  });

  /** Rationale: Only log_ip_addresses can be sent alone. */
  it("accepts log_ip_addresses alone", () => {
    const r = parse({ log_ip_addresses: true });
    expect(r.success).toBe(true);
    expect(r.data.body.log_ip_addresses).toBe(true);
  });

  /** Rationale: Only logging_enabled can be sent alone. */
  it("accepts logging_enabled alone", () => {
    const r = parse({ logging_enabled: false });
    expect(r.success).toBe(true);
    expect(r.data.body.logging_enabled).toBe(false);
  });

  /** Rationale: Both fields can be sent together. */
  it("accepts both fields together", () => {
    const r = parse({ log_ip_addresses: true, logging_enabled: true });
    expect(r.success).toBe(true);
    expect(r.data.body.log_ip_addresses).toBe(true);
    expect(r.data.body.logging_enabled).toBe(true);
  });

  /** Rationale: Non-boolean values should fail validation. */
  it("rejects non-boolean logging_enabled", () => {
    const r = parse({ logging_enabled: "yes" });
    expect(r.success).toBe(false);
  });

  /** Rationale: Non-boolean values should fail validation. */
  it("rejects non-boolean log_ip_addresses", () => {
    const r = parse({ log_ip_addresses: 1 });
    expect(r.success).toBe(false);
  });
});
