/**
 * Unit tests for logs Zod validator.
 *
 * Covers the getLogsSchema query parameter validation.
 */
import { describe, it, expect } from "vitest";
import { getLogsSchema } from "../../../src/validators/logs.js";

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

  /** Rationale: Filter by project_id should pass through. */
  it("accepts project_id filter", () => {
    const r = parse({ project_id: "5" });
    expect(r.success).toBe(true);
    expect(r.data.query.project_id).toBe("5");
  });

  /** Rationale: Multiple filter params should all pass. */
  it("accepts multiple filter params", () => {
    const r = parse({
      project_id: "1",
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

  /** Rationale: user_id and use_case_id are valid filters. */
  it("accepts user_id and use_case_id filters", () => {
    const r = parse({ user_id: "2", use_case_id: "10" });
    expect(r.success).toBe(true);
  });
});
