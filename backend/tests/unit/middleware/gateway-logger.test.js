/**
 * Unit tests for the gateway-logger middleware.
 *
 * Verifies the res.send() interception, log context handling,
 * API key masking, double-fire prevention, and body capping.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  maskApiKey,
  redactKeyInText,
  setLogContext,
  gatewayLogger,
} from "../../../src/middleware/gateway-logger.js";

// ── Mock logBuffer ────────────────────────────────────────────────────
const pushSpy = vi.fn();
vi.mock("../../../src/services/log-buffer.js", () => ({
  logBuffer: { push: (...args) => pushSpy(...args) },
}));

// ── Helpers ───────────────────────────────────────────────────────────

/** Create a minimal mock request. */
function mockReq() {
  return { headers: {} };
}

/** Create a minimal mock response with chainable status() and send(). */
function mockRes() {
  const res = {
    statusCode: 200,
    _headers: {},
    getHeader(name) {
      return this._headers[name.toLowerCase()];
    },
    setHeader(name, value) {
      this._headers[name.toLowerCase()] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    send: vi.fn().mockReturnThis(),
    json(data) {
      this._headers["content-type"] = "application/json";
      return this.send(JSON.stringify(data));
    },
  };
  return res;
}

// ═══════════════════════════════════════════════════════════════════════
// maskApiKey
// ═══════════════════════════════════════════════════════════════════════

describe("maskApiKey", () => {
  it("masks the middle portion of a long key", () => {
    expect(maskApiKey("uc-aaaaaa-ReplaceMe123")).toBe("uc-***123");
  });

  it("returns short keys unchanged (≤6 chars)", () => {
    expect(maskApiKey("short")).toBe("short");
    expect(maskApiKey("abcdef")).toBe("abcdef");
  });

  it("handles 7-char keys (minimum masking)", () => {
    expect(maskApiKey("1234567")).toBe("123***567");
  });

  it("returns falsy values as-is", () => {
    expect(maskApiKey("")).toBe("");
    expect(maskApiKey(null)).toBe(null);
    expect(maskApiKey(undefined)).toBe(undefined);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// redactKeyInText
// ═══════════════════════════════════════════════════════════════════════

describe("redactKeyInText", () => {
  it("replaces all occurrences of the API key with masked version", () => {
    const key = "uc-abc123-SecretValue";
    const text = `{"auth": "${key}", "backup": "${key}"}`;
    const result = redactKeyInText(text, key);
    expect(result).not.toContain(key);
    expect(result).toContain("uc-***lue");
    // Both occurrences should be replaced
    expect(result.match(/uc-\*\*\*lue/g)).toHaveLength(2);
  });

  it("returns text unchanged if key is falsy", () => {
    expect(redactKeyInText("some text", "")).toBe("some text");
    expect(redactKeyInText("some text", null)).toBe("some text");
  });

  it("returns text unchanged if text is falsy", () => {
    expect(redactKeyInText("", "key")).toBe("");
    expect(redactKeyInText(null, "key")).toBe(null);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// setLogContext
// ═══════════════════════════════════════════════════════════════════════

describe("setLogContext", () => {
  it("attaches log context to req._gatewayLogContext", () => {
    const req = mockReq();
    const data = { apiKeyId: 1, resourceId: 2, method: "GET", url: "/test" };
    setLogContext(req, data);
    expect(req._gatewayLogContext).toEqual(data);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// gatewayLogger middleware
// ═══════════════════════════════════════════════════════════════════════

describe("gatewayLogger middleware", () => {
  beforeEach(() => {
    pushSpy.mockClear();
  });

  it("calls next() immediately", () => {
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    gatewayLogger()(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("pushes a log entry when res.send() is called with log context", () => {
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    gatewayLogger()(req, res, next);

    // Simulate proxy setting log context
    setLogContext(req, {
      apiKeyId: 1,
      resourceId: 2,
      method: "GET",
      url: "http://example.com/test",
      headers: '{"host":"example.com"}',
      body: '{"key":"value"}',
      ip: "127.0.0.1",
    });

    // Simulate response being sent
    res.status(200).send('{"ok":true}');

    expect(pushSpy).toHaveBeenCalledTimes(1);
    const entry = pushSpy.mock.calls[0][0];
    expect(entry.apiKeyId).toBe(1);
    expect(entry.resourceId).toBe(2);
    expect(entry.method).toBe("GET");
    expect(entry.responseCode).toBe(200);
    expect(entry.responseBody).toBe('{"ok":true}');
    expect(entry.durationMs).toBeTypeOf("number");
    expect(entry.ip).toBe("127.0.0.1");
  });

  it("is a no-op when req._gatewayLogContext is not set (pre-resolution exit)", () => {
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    gatewayLogger()(req, res, next);

    // No setLogContext call — simulate 404 before API key resolution
    res.status(404).send('{"error":"Not found"}');

    expect(pushSpy).not.toHaveBeenCalled();
  });

  it("prevents double logging (res.send called twice)", () => {
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    gatewayLogger()(req, res, next);
    setLogContext(req, {
      apiKeyId: 1,
      resourceId: 2,
      method: "POST",
      url: "http://example.com/test",
      headers: "{}",
      body: "{}",
      ip: null,
    });

    res.send('{"first":true}');
    res.send('{"second":true}'); // should NOT log again

    expect(pushSpy).toHaveBeenCalledTimes(1);
  });

  it("caps response body at 10,000 characters", () => {
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    gatewayLogger()(req, res, next);
    setLogContext(req, {
      apiKeyId: 1,
      resourceId: 2,
      method: "GET",
      url: "http://example.com/test",
      headers: "{}",
      body: "{}",
      ip: null,
    });

    const longBody = "x".repeat(20000);
    res.status(200).send(longBody);

    const entry = pushSpy.mock.calls[0][0];
    expect(entry.responseBody).toHaveLength(10000);
  });

  it("stores '[binary data]' for Buffer responses with non-text content type", () => {
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    gatewayLogger()(req, res, next);
    setLogContext(req, {
      apiKeyId: 1,
      resourceId: 2,
      method: "GET",
      url: "http://example.com/image.png",
      headers: "{}",
      body: "[binary data]",
      ip: null,
    });

    res.setHeader("content-type", "image/png");
    res.status(200).send(Buffer.from([0x89, 0x50, 0x4e, 0x47]));

    const entry = pushSpy.mock.calls[0][0];
    expect(entry.responseBody).toBe("[binary data]");
  });

  it("reads upstream status code from req._upstreamStatusCode", () => {
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    gatewayLogger()(req, res, next);
    setLogContext(req, {
      apiKeyId: 1,
      resourceId: 2,
      method: "GET",
      url: "http://example.com/test",
      headers: "{}",
      body: "{}",
      ip: null,
    });

    req._upstreamStatusCode = 201;
    res.status(201).send('{"created":true}');

    const entry = pushSpy.mock.calls[0][0];
    expect(entry.upstreamStatusCode).toBe(201);
  });

  it("handles null upstream status code when not set", () => {
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    gatewayLogger()(req, res, next);
    setLogContext(req, {
      apiKeyId: 1,
      resourceId: 2,
      method: "GET",
      url: "http://example.com/test",
      headers: "{}",
      body: "{}",
      ip: null,
    });

    res.status(403).send('{"error":"Forbidden"}');

    const entry = pushSpy.mock.calls[0][0];
    expect(entry.upstreamStatusCode).toBeNull();
  });

  it("stores Buffer text content when content-type is JSON", () => {
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    gatewayLogger()(req, res, next);
    setLogContext(req, {
      apiKeyId: 1,
      resourceId: 2,
      method: "GET",
      url: "http://example.com/test",
      headers: "{}",
      body: "{}",
      ip: null,
    });

    res.setHeader("content-type", "application/json; charset=utf-8");
    const jsonBuffer = Buffer.from('{"key":"value"}');
    res.status(200).send(jsonBuffer);

    const entry = pushSpy.mock.calls[0][0];
    expect(entry.responseBody).toBe('{"key":"value"}');
  });

  it("does NOT push a log entry when loggingEnabled is false", () => {
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    gatewayLogger()(req, res, next);

    // Simulate proxy setting log context with logging disabled
    setLogContext(req, {
      apiKeyId: 1,
      resourceId: 2,
      method: "GET",
      url: "http://example.com/test",
      headers: '{"host":"example.com"}',
      body: '{"key":"value"}',
      ip: "127.0.0.1",
      loggingEnabled: false,
    });

    res.status(200).send('{"ok":true}');

    expect(pushSpy).not.toHaveBeenCalled();
  });

  it("pushes a log entry when loggingEnabled is explicitly true", () => {
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    gatewayLogger()(req, res, next);
    setLogContext(req, {
      apiKeyId: 1,
      resourceId: 2,
      method: "POST",
      url: "http://example.com/test",
      headers: "{}",
      body: "{}",
      ip: null,
      loggingEnabled: true,
    });

    res.status(200).send('{"ok":true}');

    expect(pushSpy).toHaveBeenCalledTimes(1);
  });
});
