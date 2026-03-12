import { logBuffer } from "../services/log-buffer.js";

// ── Constants ─────────────────────────────────────────────────────────

/** Maximum response body size stored in request_logs (characters). */
const MAX_RESPONSE_BODY_LENGTH = 10000;

// ── Helpers ───────────────────────────────────────────────────────────

/**
 * Partially mask an API key, preserving the first 3 and last 3 characters.
 *
 * @param {string} key – The raw API key value.
 * @returns {string} Masked key, e.g. "um-***123".
 *
 * @example
 *   maskApiKey("um-aaaaaa-ReplaceMe123") // → "um-***123"
 *   maskApiKey("short")                  // → "short" (unchanged)
 */
export function maskApiKey(key) {
  if (!key || key.length <= 6) return key;
  return key.slice(0, 3) + "***" + key.slice(-3);
}

/**
 * Replace all occurrences of `rawKey` with its masked version in `text`.
 * Returns the original string unchanged if `rawKey` is falsy.
 *
 * @param {string} text   – String to redact (e.g. JSON-stringified headers).
 * @param {string} rawKey – The raw API key to mask.
 * @returns {string}
 */
export function redactKeyInText(text, rawKey) {
  if (!text || !rawKey) return text;
  return text.replaceAll(rawKey, maskApiKey(rawKey));
}

/**
 * Determine whether a Content-Type header value represents text-based content
 * whose body is safe to store as a string.
 *
 * @param {string} contentType
 * @returns {boolean}
 */
function isTextContentType(contentType) {
  if (!contentType) return false;
  return (
    contentType.includes("json") ||
    contentType.includes("text") ||
    contentType.includes("xml") ||
    contentType.includes("x-www-form-urlencoded")
  );
}

// ── Log Context ───────────────────────────────────────────────────────

/**
 * Attach gateway log context to the request object.
 *
 * Call this in `proxy()` after the API key and resource have been
 * resolved.  The gateway logger middleware reads this context when
 * the response is sent and pushes a log entry to the buffer.
 *
 * @param {import("express").Request} req
 * @param {object} data
 * @param {number|null} data.apiKeyId
 * @param {number}      data.resourceId
 * @param {string}      data.method
 * @param {string}      data.url
 * @param {string}      data.headers  – JSON-stringified (already redacted).
 * @param {string}      data.body     – Request body text or "[binary data]".
 * @param {string|null} data.ip
 */
export function setLogContext(req, data) {
  req._gatewayLogContext = data;
}

// ── Middleware ─────────────────────────────────────────────────────────

/**
 * Express middleware that intercepts `res.send()` to automatically
 * log gateway requests to `request_logs` via the log buffer.
 *
 * **How it works:**
 * 1. Records the request start time.
 * 2. Monkey-patches `res.send()` with a one-shot wrapper.
 * 3. When the response is sent (by any code path — direct response
 *    OR error handler), the wrapper checks for `req._gatewayLogContext`.
 *    - If present: assembles the log entry and pushes to `logBuffer`.
 *    - If absent:  no-op (pre-resolution errors like 404/401).
 * 4. The original `res.send()` is restored and called with unmodified args.
 *
 * This design captures ALL response paths through a single point:
 * - Direct `res.send()` / `res.status().send()` calls in `proxy()`
 * - Error handler's `res.status().json()` (which internally calls `res.send()`)
 *
 * @returns {import("express").RequestHandler}
 */
export function gatewayLogger() {
  return (req, res, next) => {
    const startTime = Date.now();
    const originalSend = res.send;

    res.send = function patchedSend(body) {
      // Restore original immediately — prevents double-fire and
      // ensures downstream middleware sees the real res.send
      res.send = originalSend;

      const ctx = req._gatewayLogContext;
      if (ctx && ctx.loggingEnabled !== false) {
        const responseContentType = res.getHeader("content-type") || "";
        let responseBody;

        if (typeof body === "string") {
          responseBody = body.slice(0, MAX_RESPONSE_BODY_LENGTH);
        } else if (Buffer.isBuffer(body)) {
          responseBody = isTextContentType(String(responseContentType))
            ? body.toString("utf-8").slice(0, MAX_RESPONSE_BODY_LENGTH)
            : "[binary data]";
        } else {
          responseBody = body != null ? String(body).slice(0, MAX_RESPONSE_BODY_LENGTH) : null;
        }

        logBuffer.push({
          apiKeyId: ctx.apiKeyId,
          resourceId: ctx.resourceId,
          method: ctx.method,
          url: ctx.url,
          headers: ctx.headers,
          body: ctx.body,
          responseCode: res.statusCode,
          responseBody,
          durationMs: Date.now() - startTime,
          upstreamStatusCode: req._upstreamStatusCode ?? null,
          ip: ctx.ip,
        });
      }

      return originalSend.call(this, body);
    };

    next();
  };
}
