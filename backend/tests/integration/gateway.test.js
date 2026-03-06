/**
 * Gateway integration tests — API key replacement, resource usage limits,
 * and time lease enforcement.
 *
 * These tests exercise the full gateway proxy path using a tiny local
 * HTTP server as the mock "upstream" service.  The server captures each
 * incoming request so assertions can verify that:
 *   1) the user's API key is swapped for the resource's secret key,
 *   2) per-resource usage limits block when exhausted, and
 *   3) per-resource time leases expire correctly.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import http from "http";
import request from "supertest";
import { createTestEnv } from "../helpers/setup.js";
import {
  seedResource,
  seedPreset,
  seedApiKey,
  seedEndpointGroup,
  seedBlocklist,
  seedAllowlist,
} from "../helpers/factories.js";
import { usageCounter } from "../../src/services/usage-counter.js";

// ── Local upstream mock server ──────────────────────────────────────

let upstream; // http.Server
let upstreamPort;
let lastUpstreamReq; // { headers, url, method, body }

function startUpstream() {
  return new Promise((resolve) => {
    upstream = http.createServer((req, res) => {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        lastUpstreamReq = {
          headers: { ...req.headers },
          url: req.url,
          method: req.method,
          body,
        };
        res
          .writeHead(200, { "Content-Type": "application/json" })
          .end(JSON.stringify({ ok: true }));
      });
    });
    upstream.listen(0, "127.0.0.1", () => {
      upstreamPort = upstream.address().port;
      resolve();
    });
  });
}

function upstreamBaseUrl() {
  return `http://127.0.0.1:${upstreamPort}`;
}

// ── Test suite setup ────────────────────────────────────────────────

let app, db;

beforeAll(async () => {
  await startUpstream();
  ({ app, db } = await createTestEnv());
});

afterAll(() => {
  upstream?.close();
});

beforeEach(() => {
  lastUpstreamReq = null;
  // Clear in-memory usage counters between tests so they don't bleed
  usageCounter.reset();
});

// ═════════════════════════════════════════════════════════════════════
// 1. API key replacement
// ═════════════════════════════════════════════════════════════════════

describe("Gateway — API key replacement", () => {
  let resource, apiKeyValue;

  beforeAll(async () => {
    resource = await seedResource(db, {
      name: "Replace Test Resource",
      unique_path: "gw-replace",
      secret_api_key: "sk-real-upstream-secret-999",
      external_api_url: upstreamBaseUrl(),
    });

    // Full-access preset → skip resource / endpoint-group checks
    const preset = await seedPreset(db, {
      name: "GW Replace Preset",
      is_full_access: true,
    });

    const apiKeyRow = await seedApiKey(db, preset.id, {
      name: "GW Replace Key",
      key_value: "uc-aaaaaa-ReplaceMe123",
    });
    apiKeyValue = apiKeyRow.api_key;
  });

  /**
   * Rationale: The gateway MUST strip the user-facing API key from
   * the Authorization header and inject the resource's secret key
   * so the upstream service authenticates correctly.
   */
  it("replaces the API key in the Authorization header", async () => {
    const res = await request(app)
      .get(`/${resource.unique_path}/v1/chat`)
      .set("Authorization", `Bearer ${apiKeyValue}`);

    expect(res.status).toBe(200);
    expect(lastUpstreamReq).toBeDefined();
    // The forwarded Authorization header must contain the secret key
    expect(lastUpstreamReq.headers.authorization).toContain(
      resource.secret_api_key,
    );
    // …and NOT the original user key
    expect(lastUpstreamReq.headers.authorization).not.toContain(apiKeyValue);
  });

  /**
   * Rationale: Some APIs accept the key as a query parameter
   * (e.g. ?key=uc-...).  The gateway must replace it there too.
   */
  it("replaces the API key in query parameters", async () => {
    const res = await request(app)
      .get(`/${resource.unique_path}/v1/chat`)
      .query({ key: apiKeyValue });

    expect(res.status).toBe(200);
    expect(lastUpstreamReq).toBeDefined();
    // The upstream sees the query string — key should be the secret
    expect(lastUpstreamReq.url).toContain(resource.secret_api_key);
    expect(lastUpstreamReq.url).not.toContain(apiKeyValue);
  });

  /**
   * Rationale: LLM-style APIs often put the key inside the JSON body.
   * The gateway must do a global replace so every occurrence is swapped.
   */
  it("replaces the API key in a JSON body", async () => {
    const bodyStr = JSON.stringify({ model: "gpt-4", apiKey: apiKeyValue });
    const res = await request(app)
      .post(`/${resource.unique_path}/v1/chat`)
      .set("Content-Type", "application/json")
      .set("x-api-key", apiKeyValue)
      .send(bodyStr);

    expect(res.status).toBe(200);
    expect(lastUpstreamReq).toBeDefined();
    expect(lastUpstreamReq.body).toContain(resource.secret_api_key);
    expect(lastUpstreamReq.body).not.toContain(apiKeyValue);
  });

  /**
   * Rationale: If the API key appears multiple times in the body,
   * every occurrence must be replaced (global regex).
   */
  it("replaces ALL occurrences of the API key in the body", async () => {
    const body = JSON.stringify({
      key1: apiKeyValue,
      key2: apiKeyValue,
      nested: { key3: apiKeyValue },
    });

    const res = await request(app)
      .post(`/${resource.unique_path}/v1/chat`)
      .set("Content-Type", "application/json")
      .set("x-api-key", apiKeyValue)
      .send(body);

    expect(res.status).toBe(200);
    // Count occurrences of secret key — should be 3
    const occurrences = (
      lastUpstreamReq.body.match(
        new RegExp(
          resource.secret_api_key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
          "g",
        ),
      ) || []
    ).length;
    expect(occurrences).toBe(3);
    // Original key must not appear at all
    expect(lastUpstreamReq.body).not.toContain(apiKeyValue);
  });

  /**
   * Rationale: Gateway should still forward the request when the
   * API key is provided only via a custom header (e.g., x-api-key).
   */
  it("replaces the API key in a custom header", async () => {
    const res = await request(app)
      .get(`/${resource.unique_path}/v1/chat`)
      .set("x-api-key", apiKeyValue);

    expect(res.status).toBe(200);
    expect(lastUpstreamReq.headers["x-api-key"]).toBe(resource.secret_api_key);
  });

  /**
   * Rationale: Requests without an API key must be rejected with 401,
   * not forwarded upstream.
   */
  it("rejects requests with no API key", async () => {
    const res = await request(app)
      .get(`/${resource.unique_path}/v1/chat`);

    expect(res.status).toBe(401);
    expect(lastUpstreamReq).toBeNull(); // upstream never called
  });

  /**
   * Rationale: A fabricated key that doesn't exist in the DB must
   * fail with 401.
   */
  it("rejects requests with an unknown API key", async () => {
    const res = await request(app)
      .get(`/${resource.unique_path}/v1/chat`)
      .set("Authorization", "Bearer uc-zzzzzz-NotInDB");

    expect(res.status).toBe(401);
    expect(lastUpstreamReq).toBeNull();
  });

  /**
   * Rationale: Hitting a resource path that does not exist must
   * return 404, not 502 or a crash.
   */
  it("returns 404 for non-existent resource path", async () => {
    const res = await request(app)
      .get("/no-such-resource/v1/chat")
      .set("x-api-key", apiKeyValue);

    expect(res.status).toBe(404);
    expect(lastUpstreamReq).toBeNull();
  });

  /**
   * Rationale: Hitting a resource path without a trailing endpoint should
   * forward to the upstream root ("/"). This is valid behaviour.
   */
  it("forwards root resource path to upstream /", async () => {
    const res = await request(app)
      .get(`/${resource.unique_path}`)
      .set("x-api-key", apiKeyValue);

    expect(res.status).toBe(200);
    expect(lastUpstreamReq).toBeDefined();
    expect(lastUpstreamReq.url).toBe("/");
  });
});

// ═════════════════════════════════════════════════════════════════════
// 2. Per-resource usage limits
// ═════════════════════════════════════════════════════════════════════

describe("Gateway — resource usage limits", () => {
  let resource, apiKeyRow, apiKeyValue;

  beforeAll(async () => {
    resource = await seedResource(db, {
      name: "Limit Resource",
      unique_path: "gw-limit",
      secret_api_key: "sk-limit-secret",
      external_api_url: upstreamBaseUrl(),
    });

    // Non-full-access preset with the resource attached
    const preset = await seedPreset(db, { name: "Limit Preset" });

    // Link resource to preset WITH a usage_limit of 3
    await db.run(
      `INSERT INTO preset_resources (preset_id, resource_id, usage_limit)
       VALUES ($1, $2, $3)`,
      [preset.id, resource.id, 3],
    );

    apiKeyRow = await seedApiKey(db, preset.id, {
      name: "Limit Key",
      key_value: "uc-bbbbbb-LimitKey1",
    });
    apiKeyValue = apiKeyRow.api_key;
  });

  beforeEach(() => {
    usageCounter.reset();
  });

  /**
   * Rationale: The first request is below the limit (0 used out of 3)
   * and must succeed.
   */
  it("allows the first request within the usage limit", async () => {
    // Reset DB usage to 0 for clean state
    await db.run(
      `UPDATE api_key_quotas SET usage_counts = '{}' WHERE api_key_id = $1`,
      [apiKeyRow.id],
    );

    const res = await request(app)
      .get(`/${resource.unique_path}/v1/chat`)
      .set("x-api-key", apiKeyValue);

    expect(res.status).toBe(200);
    expect(lastUpstreamReq).toBeDefined();
  });

  /**
   * Rationale: Once total usage (DB + pending) reaches the limit,
   * the next request must be blocked with 429.
   */
  it("returns 429 when usage limit is exhausted", async () => {
    // Pre-fill DB to exactly the limit so the next request is blocked
    const projKey = `proj:${resource.id}`;
    const counts = JSON.stringify({ [projKey]: 3 });
    await db.run(
      `UPDATE api_key_quotas
       SET usage_counts = $2::jsonb
       WHERE api_key_id = $1`,
      [apiKeyRow.id, counts],
    );

    const res = await request(app)
      .get(`/${resource.unique_path}/v1/chat`)
      .set("x-api-key", apiKeyValue);

    expect(res.status).toBe(429);
    expect(res.body.error).toMatch(/usage limit/i);
  });

  /**
   * Rationale: In-memory pending counts must be included in the
   * check so rapid sequential requests can't bypass the limit.
   */
  it("tracks in-memory pending counts across rapid requests", async () => {
    // Start from zero
    await db.run(
      `UPDATE api_key_quotas SET usage_counts = '{}' WHERE api_key_id = $1`,
      [apiKeyRow.id],
    );
    usageCounter.reset();

    // Fire 3 requests — all should succeed (limit is 3)
    for (let i = 0; i < 3; i++) {
      lastUpstreamReq = null;
      const res = await request(app)
        .get(`/${resource.unique_path}/v1/chat`)
        .set("x-api-key", apiKeyValue);
      expect(res.status).toBe(200);
    }

    // 4th request should be blocked
    const blocked = await request(app)
      .get(`/${resource.unique_path}/v1/chat`)
      .set("x-api-key", apiKeyValue);

    expect(blocked.status).toBe(429);
  });

  /**
   * Rationale: If the DB already has some usage and a pending
   * increment adds to it, the combined total should be enforced.
   */
  it("combines DB and pending counts for enforcement", async () => {
    // DB already has 2 uses
    const projKey = `proj:${resource.id}`;
    const counts = JSON.stringify({ [projKey]: 2 });
    await db.run(
      `UPDATE api_key_quotas
       SET usage_counts = $2::jsonb
       WHERE api_key_id = $1`,
      [apiKeyRow.id, counts],
    );
    usageCounter.reset();

    // 1 more should be allowed (2 DB + 0 pending < 3)
    const ok = await request(app)
      .get(`/${resource.unique_path}/v1/chat`)
      .set("x-api-key", apiKeyValue);
    expect(ok.status).toBe(200);

    // Now: 2 DB + 1 pending = 3 ≥ limit → blocked
    const blocked = await request(app)
      .get(`/${resource.unique_path}/v1/chat`)
      .set("x-api-key", apiKeyValue);
    expect(blocked.status).toBe(429);
  });
});

// ═════════════════════════════════════════════════════════════════════
// 3. Per-resource time lease
// ═════════════════════════════════════════════════════════════════════

describe("Gateway — time lease on resources", () => {
  let resource, apiKeyRow, apiKeyValue;

  beforeAll(async () => {
    resource = await seedResource(db, {
      name: "Lease Resource",
      unique_path: "gw-lease",
      secret_api_key: "sk-lease-secret",
      external_api_url: upstreamBaseUrl(),
    });

    // Non-full-access preset with lease_seconds on the resource mapping
    const preset = await seedPreset(db, { name: "Lease Preset" });

    // Link resource with a 300-second lease
    await db.run(
      `INSERT INTO preset_resources (preset_id, resource_id, lease_seconds)
       VALUES ($1, $2, $3)`,
      [preset.id, resource.id, 300],
    );

    apiKeyRow = await seedApiKey(db, preset.id, {
      name: "Lease Key",
      key_value: "uc-cccccc-LeaseKey1",
    });
    apiKeyValue = apiKeyRow.api_key;
  });

  beforeEach(() => {
    usageCounter.reset();
  });

  /**
   * Rationale: On the very first request, no expiry exists yet. The
   * gateway should initialize the lease and proxy successfully.
   */
  it("initializes lease on first request and succeeds", async () => {
    // Ensure no prior expiry
    await db.run(
      `UPDATE api_key_quotas SET expiry_dates = '{}' WHERE api_key_id = $1`,
      [apiKeyRow.id],
    );

    const res = await request(app)
      .get(`/${resource.unique_path}/v1/chat`)
      .set("x-api-key", apiKeyValue);

    expect(res.status).toBe(200);

    // Verify lease was written to DB
    const quota = await db.get(
      "SELECT expiry_dates FROM api_key_quotas WHERE api_key_id = $1",
      [apiKeyRow.id],
    );
    const projKey = `proj:${resource.id}`;
    expect(quota.expiry_dates[projKey]).toBeDefined();

    // Expiry should be ~300 seconds in the future
    const expiryMs = new Date(quota.expiry_dates[projKey]).getTime();
    const expectedMs = Date.now() + 300 * 1000;
    expect(Math.abs(expiryMs - expectedMs)).toBeLessThan(5000); // within 5s tolerance
  });

  /**
   * Rationale: Subsequent requests within the lease window must
   * pass through without re-initializing the lease.
   */
  it("allows access within the lease period", async () => {
    // Set a valid future expiry
    const projKey = `proj:${resource.id}`;
    const future = new Date(Date.now() + 120_000).toISOString(); // 2 min from now
    const dates = JSON.stringify({ [projKey]: future });
    await db.run(
      `UPDATE api_key_quotas
       SET expiry_dates = $2::jsonb
       WHERE api_key_id = $1`,
      [apiKeyRow.id, dates],
    );

    const res = await request(app)
      .get(`/${resource.unique_path}/v1/chat`)
      .set("x-api-key", apiKeyValue);

    expect(res.status).toBe(200);
    expect(lastUpstreamReq).toBeDefined();
  });

  /**
   * Rationale: Once the lease has expired, the gateway must deny
   * access with a 403 "Access expired" error.
   */
  it("returns 403 when lease has expired", async () => {
    // Manually set an already-expired lease in the DB
    const projKey = `proj:${resource.id}`;
    const past = new Date(Date.now() - 60_000).toISOString(); // 1 min ago
    const dates = JSON.stringify({ [projKey]: past });
    await db.run(
      `UPDATE api_key_quotas
       SET expiry_dates = $2::jsonb
       WHERE api_key_id = $1`,
      [apiKeyRow.id, dates],
    );

    const res = await request(app)
      .get(`/${resource.unique_path}/v1/chat`)
      .set("x-api-key", apiKeyValue);

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/expired/i);
    expect(lastUpstreamReq).toBeNull(); // upstream was NOT called
  });

  /**
   * Rationale: Verify that lease and usage_limit work together.
   * A resource can have BOTH constraints — both must pass.
   */
  it("enforces both lease AND usage_limit on the same resource", async () => {
    // Create a new resource with both limits
    const combo = await seedResource(db, {
      name: "Combo Resource",
      unique_path: "gw-combo",
      secret_api_key: "sk-combo-secret",
      external_api_url: upstreamBaseUrl(),
    });

    const preset = await seedPreset(db, { name: "Combo Preset" });
    await db.run(
      `INSERT INTO preset_resources (preset_id, resource_id, usage_limit, lease_seconds)
       VALUES ($1, $2, $3, $4)`,
      [preset.id, combo.id, 2, 600],
    );

    const key = await seedApiKey(db, preset.id, {
      name: "Combo Key",
      key_value: "uc-dddddd-ComboKey1",
    });

    // 1st request — initializes lease, usage=1/2 → OK
    let res = await request(app)
      .get(`/${combo.unique_path}/v1/chat`)
      .set("x-api-key", key.api_key);
    expect(res.status).toBe(200);

    // 2nd request — usage=2/2 → OK (check happens before increment on this request)
    res = await request(app)
      .get(`/${combo.unique_path}/v1/chat`)
      .set("x-api-key", key.api_key);
    expect(res.status).toBe(200);

    // 3rd request — usage=2 pending+0 db ≥ 2 → 429
    res = await request(app)
      .get(`/${combo.unique_path}/v1/chat`)
      .set("x-api-key", key.api_key);
    expect(res.status).toBe(429);

    // Now expire the lease and reset usage — should get 403 (lease expired)
    const projKey = `proj:${combo.id}`;
    const past = new Date(Date.now() - 60_000).toISOString();
    const dates = JSON.stringify({ [projKey]: past });
    await db.run(
      `UPDATE api_key_quotas
       SET expiry_dates = $2::jsonb,
           usage_counts = '{}'
       WHERE api_key_id = $1`,
      [key.id, dates],
    );
    usageCounter.reset();

    res = await request(app)
      .get(`/${combo.unique_path}/v1/chat`)
      .set("x-api-key", key.api_key);
    expect(res.status).toBe(403);
  });

  /**
   * Rationale: A full-access preset bypasses all per-resource quotas
   * (usage_limit and lease_seconds), even if resource rows exist.
   */
  it("full-access preset is NOT subject to resource limits", async () => {
    const fullPreset = await seedPreset(db, {
      name: "Full Access Lease",
      is_full_access: true,
    });

    const key = await seedApiKey(db, fullPreset.id, {
      name: "Full Key",
      key_value: "uc-eeeeee-FullKey99",
    });

    // Even though the resource has a lease config in preset_resources,
    // a full-access preset skips the check entirely.
    const res = await request(app)
      .get(`/${resource.unique_path}/v1/chat`)
      .set("x-api-key", key.api_key);

    expect(res.status).toBe(200);
    expect(lastUpstreamReq).toBeDefined();
  });
});

// ═════════════════════════════════════════════════════════════════════
// 4. Per-key global quota (usage_limit & lease_duration_seconds)
// ═════════════════════════════════════════════════════════════════════

describe("Gateway — per-key global quota", () => {
  let resource;

  beforeAll(async () => {
    resource = await seedResource(db, {
      name: "Global Quota Resource",
      unique_path: "gw-global-q",
      secret_api_key: "sk-global-quota-secret",
      external_api_url: upstreamBaseUrl(),
    });
  });

  beforeEach(() => {
    usageCounter.reset();
  });

  /**
   * Rationale: A key with no usage_limit or lease_duration_seconds
   * should be unaffected by the global quota check.
   */
  it("passes through when key has no quotas configured", async () => {
    const preset = await seedPreset(db, {
      name: "No Quota Preset GW",
      is_full_access: true,
    });
    const key = await seedApiKey(db, preset.id, {
      name: "No Quota Key GW",
      key_value: "uc-gq0000-NoQuota1",
    });

    const res = await request(app)
      .get(`/${resource.unique_path}/v1/chat`)
      .set("x-api-key", key.api_key);

    expect(res.status).toBe(200);
  });

  /**
   * Rationale: When usage_limit is set on the key, gateway should
   * block once the global count reaches the limit.
   */
  it("blocks requests when global usage_limit is exhausted", async () => {
    const preset = await seedPreset(db, {
      name: "Global Limit Preset",
      is_full_access: true,
    });
    const key = await seedApiKey(db, preset.id, {
      name: "Global Limit Key",
      key_value: "uc-gq1111-GLimit1",
      usage_limit: 2,
    });

    // Reset DB usage
    await db.run(
      `UPDATE api_key_quotas SET usage_counts = '{}' WHERE api_key_id = $1`,
      [key.id],
    );

    // 1st request — OK (0 < 2)
    let res = await request(app)
      .get(`/${resource.unique_path}/v1/chat`)
      .set("x-api-key", key.api_key);
    expect(res.status).toBe(200);

    // 2nd request — OK (1 < 2)
    res = await request(app)
      .get(`/${resource.unique_path}/v1/chat`)
      .set("x-api-key", key.api_key);
    expect(res.status).toBe(200);

    // 3rd request — blocked (2 >= 2)
    res = await request(app)
      .get(`/${resource.unique_path}/v1/chat`)
      .set("x-api-key", key.api_key);
    expect(res.status).toBe(429);
    expect(res.body.error).toMatch(/usage limit/i);
  });

  /**
   * Rationale: The first request through a key with a lease should
   * initialize the global expiry date.
   */
  it("initializes global lease on first request", async () => {
    const preset = await seedPreset(db, {
      name: "Global Lease Preset",
      is_full_access: true,
    });
    const key = await seedApiKey(db, preset.id, {
      name: "Global Lease Key",
      key_value: "uc-gq2222-GLease1",
      lease_duration_seconds: 600,
    });

    // Clear any prior expiry
    await db.run(
      `UPDATE api_key_quotas SET expiry_dates = '{}' WHERE api_key_id = $1`,
      [key.id],
    );

    const res = await request(app)
      .get(`/${resource.unique_path}/v1/chat`)
      .set("x-api-key", key.api_key);
    expect(res.status).toBe(200);

    // Verify lease was written to DB
    const quota = await db.get(
      "SELECT expiry_dates FROM api_key_quotas WHERE api_key_id = $1",
      [key.id],
    );
    expect(quota.expiry_dates["global"]).toBeDefined();

    // Expiry should be ~600 seconds in the future
    const expiryMs = new Date(quota.expiry_dates["global"]).getTime();
    const expectedMs = Date.now() + 600 * 1000;
    expect(Math.abs(expiryMs - expectedMs)).toBeLessThan(5000);
  });

  /**
   * Rationale: Once the global lease has expired, the key should be
   * rejected with 403.
   */
  it("returns 403 when global lease has expired", async () => {
    const preset = await seedPreset(db, {
      name: "Expired Lease Preset",
      is_full_access: true,
    });
    const key = await seedApiKey(db, preset.id, {
      name: "Expired Lease Key",
      key_value: "uc-gq3333-Expire1",
      lease_duration_seconds: 60,
    });

    // Set an already-expired global lease
    const past = new Date(Date.now() - 60_000).toISOString();
    const dates = JSON.stringify({ global: past });
    await db.run(
      `UPDATE api_key_quotas
       SET expiry_dates = $2::jsonb
       WHERE api_key_id = $1`,
      [key.id, dates],
    );

    const res = await request(app)
      .get(`/${resource.unique_path}/v1/chat`)
      .set("x-api-key", key.api_key);

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/expired/i);
  });

  /**
   * Rationale: Both global usage_limit and lease_duration_seconds can
   * be set on the same key — both must pass for the request to succeed.
   */
  it("enforces both global usage_limit AND lease on the same key", async () => {
    const preset = await seedPreset(db, {
      name: "Global Combo Preset",
      is_full_access: true,
    });
    const key = await seedApiKey(db, preset.id, {
      name: "Global Combo Key",
      key_value: "uc-gq4444-GCombo1",
      usage_limit: 2,
      lease_duration_seconds: 600,
    });

    // Clear state
    await db.run(
      `UPDATE api_key_quotas SET usage_counts = '{}', expiry_dates = '{}' WHERE api_key_id = $1`,
      [key.id],
    );

    // 1st request — initializes lease, usage=1/2 → OK
    let res = await request(app)
      .get(`/${resource.unique_path}/v1/chat`)
      .set("x-api-key", key.api_key);
    expect(res.status).toBe(200);

    // 2nd request — usage=2/2 → OK
    res = await request(app)
      .get(`/${resource.unique_path}/v1/chat`)
      .set("x-api-key", key.api_key);
    expect(res.status).toBe(200);

    // 3rd request — blocked (usage 2 >= 2)
    res = await request(app)
      .get(`/${resource.unique_path}/v1/chat`)
      .set("x-api-key", key.api_key);
    expect(res.status).toBe(429);

    // Expire the lease and reset usage — should get 403
    const past = new Date(Date.now() - 60_000).toISOString();
    await db.run(
      `UPDATE api_key_quotas
       SET expiry_dates = $2::jsonb, usage_counts = '{}'
       WHERE api_key_id = $1`,
      [key.id, JSON.stringify({ global: past })],
    );
    usageCounter.reset();

    res = await request(app)
      .get(`/${resource.unique_path}/v1/chat`)
      .set("x-api-key", key.api_key);
    expect(res.status).toBe(403);
  });

  /**
   * Rationale: Per-key global quota is independent of per-resource
   * preset quota. A full-access preset should still enforce per-key limits.
   */
  it("full-access preset still enforces per-key global quota", async () => {
    const preset = await seedPreset(db, {
      name: "Full But Limited",
      is_full_access: true,
    });
    const key = await seedApiKey(db, preset.id, {
      name: "Full But Limited Key",
      key_value: "uc-gq5555-FLim1",
      usage_limit: 1,
    });

    // Reset
    await db.run(
      `UPDATE api_key_quotas SET usage_counts = '{}' WHERE api_key_id = $1`,
      [key.id],
    );

    // 1st request — OK
    let res = await request(app)
      .get(`/${resource.unique_path}/v1/chat`)
      .set("x-api-key", key.api_key);
    expect(res.status).toBe(200);

    // 2nd request — blocked
    res = await request(app)
      .get(`/${resource.unique_path}/v1/chat`)
      .set("x-api-key", key.api_key);
    expect(res.status).toBe(429);
  });
});

// ═════════════════════════════════════════════════════════════════════
// 6. IP blocklist/allowlist — comma-separated IP support
// ═════════════════════════════════════════════════════════════════════

describe("Gateway — IP comma-separated support", () => {
  let resource, fullPreset, apiKeyValue;

  beforeAll(async () => {
    resource = await seedResource(db, {
      name: "IP Split Resource",
      unique_path: "gw-ip-split",
      secret_api_key: "sk-ip-split-secret",
      external_api_url: upstreamBaseUrl(),
    });

    fullPreset = await seedPreset(db, {
      name: "IP Split Preset",
      is_full_access: true,
    });

    const key = await seedApiKey(db, fullPreset.id, {
      name: "IP Split Key",
      key_value: "uc-ipspl0-IPSplitKey1",
    });
    apiKeyValue = key.api_key;
  });

  /**
   * Rationale: IPs stored as comma-separated must be parsed correctly.
   * Previously only newline splitting was supported.
   */
  it("blocks comma-separated IPs in a blocklist", async () => {
    const blocklist = await seedBlocklist(db, {
      name: "Comma Blocklist",
      ips: "10.0.0.1,::ffff:127.0.0.1,::1,192.168.1.100",
    });

    await db.run(
      "UPDATE presets SET ip_blocklist_id = $1 WHERE id = $2",
      [blocklist.id, fullPreset.id],
    );

    const res = await request(app)
      .get(`/${resource.unique_path}/v1/test`)
      .set("x-api-key", apiKeyValue);

    expect(res.status).toBe(403);

    await db.run(
      "UPDATE presets SET ip_blocklist_id = NULL WHERE id = $1",
      [fullPreset.id],
    );
  });

  it("blocks newline-separated IPs in a blocklist", async () => {
    const blocklist = await seedBlocklist(db, {
      name: "Newline Blocklist",
      ips: "10.0.0.1\n::ffff:127.0.0.1\n::1\n192.168.1.100",
    });

    await db.run(
      "UPDATE presets SET ip_blocklist_id = $1 WHERE id = $2",
      [blocklist.id, fullPreset.id],
    );

    const res = await request(app)
      .get(`/${resource.unique_path}/v1/test`)
      .set("x-api-key", apiKeyValue);

    expect(res.status).toBe(403);

    await db.run(
      "UPDATE presets SET ip_blocklist_id = NULL WHERE id = $1",
      [fullPreset.id],
    );
  });

  it("blocks mixed comma+newline IPs in a blocklist", async () => {
    const blocklist = await seedBlocklist(db, {
      name: "Mixed Blocklist",
      ips: "10.0.0.1,::ffff:127.0.0.1\n::1,192.168.1.100",
    });

    await db.run(
      "UPDATE presets SET ip_blocklist_id = $1 WHERE id = $2",
      [blocklist.id, fullPreset.id],
    );

    const res = await request(app)
      .get(`/${resource.unique_path}/v1/test`)
      .set("x-api-key", apiKeyValue);

    expect(res.status).toBe(403);

    await db.run(
      "UPDATE presets SET ip_blocklist_id = NULL WHERE id = $1",
      [fullPreset.id],
    );
  });

  it("allows traffic when comma-separated allowlist includes client IP", async () => {
    const allowlist = await seedAllowlist(db, {
      name: "Comma Allowlist",
      ips: "10.0.0.1,::ffff:127.0.0.1,::1,192.168.1.50",
    });

    await db.run(
      "UPDATE presets SET ip_allowlist_id = $1 WHERE id = $2",
      [allowlist.id, fullPreset.id],
    );

    const res = await request(app)
      .get(`/${resource.unique_path}/v1/test`)
      .set("x-api-key", apiKeyValue);

    expect(res.status).toBe(200);

    await db.run(
      "UPDATE presets SET ip_allowlist_id = NULL WHERE id = $1",
      [fullPreset.id],
    );
  });

  it("denies traffic when comma-separated allowlist excludes client IP", async () => {
    const allowlist = await seedAllowlist(db, {
      name: "Exclusive Allowlist",
      ips: "10.0.0.1,10.0.0.2,192.168.1.50",
    });

    await db.run(
      "UPDATE presets SET ip_allowlist_id = $1 WHERE id = $2",
      [allowlist.id, fullPreset.id],
    );

    const res = await request(app)
      .get(`/${resource.unique_path}/v1/test`)
      .set("x-api-key", apiKeyValue);

    expect(res.status).toBe(403);

    await db.run(
      "UPDATE presets SET ip_allowlist_id = NULL WHERE id = $1",
      [fullPreset.id],
    );
  });
});

// ═════════════════════════════════════════════════════════════════════
// 7. Root route forwarding
// ═════════════════════════════════════════════════════════════════════

describe("Gateway — root route forwarding", () => {
  let resource, apiKeyValue;

  beforeAll(async () => {
    resource = await seedResource(db, {
      name: "Root Route Resource",
      unique_path: "gw-root",
      secret_api_key: "sk-root-route-secret",
      external_api_url: upstreamBaseUrl(),
    });

    const preset = await seedPreset(db, {
      name: "Root Route Preset",
      is_full_access: true,
    });

    const key = await seedApiKey(db, preset.id, {
      name: "Root Route Key",
      key_value: "uc-rootr0-RootRouteKey1",
    });
    apiKeyValue = key.api_key;
  });

  /**
   * Rationale: Hitting /:resourcePath without a trailing path should
   * forward to the upstream root ("/"), not return 400.
   */
  it("forwards /:resourcePath to upstream /", async () => {
    const res = await request(app)
      .get(`/${resource.unique_path}`)
      .set("x-api-key", apiKeyValue);

    expect(res.status).toBe(200);
    expect(lastUpstreamReq).toBeDefined();
    expect(lastUpstreamReq.url).toBe("/");
    expect(lastUpstreamReq.method).toBe("GET");
  });

  it("still forwards /:resourcePath/sub/path correctly", async () => {
    const res = await request(app)
      .get(`/${resource.unique_path}/sub/path`)
      .set("x-api-key", apiKeyValue);

    expect(res.status).toBe(200);
    expect(lastUpstreamReq).toBeDefined();
    expect(lastUpstreamReq.url).toBe("/sub/path");
  });

  it("replaces the API key when forwarding root route", async () => {
    const res = await request(app)
      .get(`/${resource.unique_path}`)
      .set("Authorization", `Bearer ${apiKeyValue}`);

    expect(res.status).toBe(200);
    expect(lastUpstreamReq.headers.authorization).toContain(
      resource.secret_api_key,
    );
    expect(lastUpstreamReq.headers.authorization).not.toContain(apiKeyValue);
  });

  it("rejects unauthenticated root route requests", async () => {
    const res = await request(app)
      .get(`/${resource.unique_path}`);

    expect(res.status).toBe(401);
    expect(lastUpstreamReq).toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════════
// 8. Endpoint wildcard matching — single-segment safety
// ═════════════════════════════════════════════════════════════════════

describe("Gateway — endpoint wildcard matching", () => {
  let resource, apiKeyValue;

  beforeAll(async () => {
    resource = await seedResource(db, {
      name: "Wildcard Resource",
      unique_path: "gw-wildcard",
      secret_api_key: "sk-wildcard-secret",
      external_api_url: upstreamBaseUrl(),
    });

    const preset = await seedPreset(db, {
      name: "Wildcard Preset",
      is_full_access: false,
    });

    // Link resource to preset
    await db.run(
      "INSERT INTO preset_resources (preset_id, resource_id) VALUES ($1, $2)",
      [preset.id, resource.id],
    );

    // Create an endpoint group with a wildcard pattern
    const eg = await seedEndpointGroup(db, resource.id, {
      name: "Wildcard EG",
    });
    // Add endpoint: /api/*/users — should match single segment only
    await db.run(
      "INSERT INTO endpoints (endpoint_group_id, url_pattern, method) VALUES ($1, $2, $3)",
      [eg.id, "/api/*/users", "GET"],
    );
    // Link to preset
    await db.run(
      "INSERT INTO preset_endpoint_groups (preset_id, endpoint_group_id) VALUES ($1, $2)",
      [preset.id, eg.id],
    );

    const key = await seedApiKey(db, preset.id, {
      name: "Wildcard Key",
      key_value: "uc-wild00-WildKey1",
    });
    apiKeyValue = key.api_key;
  });

  /**
   * Rationale: a wildcard endpoint pattern like "/api/STAR/users" should
   * match single-segment paths like /api/v1/users.
   */
  it("matches single-segment wildcard", async () => {
    const res = await request(app)
      .get(`/${resource.unique_path}/api/v1/users`)
      .set("x-api-key", apiKeyValue);

    expect(res.status).toBe(200);
    expect(lastUpstreamReq).toBeDefined();
  });

  /**
   * Rationale: a single wildcard should NOT match multiple path segments.
   * This prevents ReDoS from nested greedy patterns and follows standard
   * glob conventions.
   */
  it("does NOT match multi-segment path with single wildcard", async () => {
    const res = await request(app)
      .get(`/${resource.unique_path}/api/v1/v2/users`)
      .set("x-api-key", apiKeyValue);

    // Should be denied — /api/v1/v2/users doesn't match /api/*/users
    expect(res.status).toBe(403);
    expect(lastUpstreamReq).toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════════
// 9. IP allowlist — deleted list passes traffic through
// ═════════════════════════════════════════════════════════════════════

describe("Gateway — allowlist null disambiguation", () => {
  let resource, apiKeyValue, preset;

  beforeAll(async () => {
    resource = await seedResource(db, {
      name: "Allowlist Null Resource",
      unique_path: "gw-al-null",
      secret_api_key: "sk-al-null-secret",
      external_api_url: upstreamBaseUrl(),
    });

    preset = await seedPreset(db, {
      name: "Allowlist Null Preset",
      is_full_access: true,
    });

    const key = await seedApiKey(db, preset.id, {
      name: "Allowlist Null Key",
      key_value: "uc-alnul0-ALNullKey1",
    });
    apiKeyValue = key.api_key;
  });

  /**
   * Rationale: If a preset references an allowlist ID that no longer
   * exists in the DB, traffic should pass through (no restriction)
   * rather than silently blocking. We simulate this by creating an
   * allowlist, attaching it, then deleting the row and manually
   * re-setting the FK (bypassing ON DELETE SET NULL).
   */
  it("passes traffic when preset references a non-existent allowlist", async () => {
    // Create a real allowlist and attach it
    const allowlist = await seedAllowlist(db, {
      name: "Orphan Allowlist",
      ips: "10.0.0.1",
    });
    await db.run(
      "UPDATE presets SET ip_allowlist_id = $1 WHERE id = $2",
      [allowlist.id, preset.id],
    );

    // Delete the allowlist row — FK ON DELETE SET NULL will null the preset column
    await db.run("DELETE FROM ip_allowlists WHERE id = $1", [allowlist.id]);

    // Manually re-set the orphaned reference (disable/re-enable FK)
    await db.run("SET session_replication_role = replica");
    await db.run(
      "UPDATE presets SET ip_allowlist_id = $1 WHERE id = $2",
      [allowlist.id, preset.id],
    );
    await db.run("SET session_replication_role = DEFAULT");

    const res = await request(app)
      .get(`/${resource.unique_path}/v1/test`)
      .set("x-api-key", apiKeyValue);

    // Should pass through since the allowlist doesn't exist
    expect(res.status).toBe(200);
    expect(lastUpstreamReq).toBeDefined();

    // Clean up
    await db.run("SET session_replication_role = replica");
    await db.run(
      "UPDATE presets SET ip_allowlist_id = NULL WHERE id = $1",
      [preset.id],
    );
    await db.run("SET session_replication_role = DEFAULT");
  });
});

