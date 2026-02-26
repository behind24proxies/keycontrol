import axios from "axios";
import { getDb } from "../db/index.js";
import { rateLimiter } from "../services/rate-limiter.js";
import { logBuffer } from "../services/log-buffer.js";
import { usageCounter } from "../services/usage-counter.js";
import { AppError } from "../errors/AppError.js";
import { logger } from "../utils/logger.js";
import { getOrg } from "../services/org.service.js";

import net from "net";

// ── Helpers ───────────────────────────────────────────────────────────

/**
 * Check if an IP address matches a pattern.
 * Supports: exact IPs, wildcard patterns (e.g. "192.168.*"), and CIDR (e.g. "10.0.0.0/8").
 */
function ipMatchesPattern(ip, pattern) {
  // CIDR notation (e.g. "192.168.1.0/24")
  if (pattern.includes("/")) {
    const [subnet, prefixStr] = pattern.split("/");
    const prefix = parseInt(prefixStr, 10);
    if (!net.isIP(subnet) || isNaN(prefix)) return false;

    // IPv4 only — convert to 32-bit integers and compare masked values
    const ipNum = ipToInt(ip);
    const subnetNum = ipToInt(subnet);
    if (ipNum === null || subnetNum === null) return false;

    const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
    return (ipNum & mask) === (subnetNum & mask);
  }

  // Wildcard pattern (e.g. "192.168.*" or "10.0.*.*")
  if (pattern.includes("*")) {
    const escaped = pattern.replace(/\./g, "\\.").replace(/\*/g, ".*");
    return new RegExp(`^${escaped}$`).test(ip);
  }

  // Exact match
  return ip === pattern;
}

/** Convert an IPv4 address string to a 32-bit unsigned integer, or null. */
function ipToInt(ipStr) {
  if (!net.isIPv4(ipStr)) return null;
  const parts = ipStr.split(".").map(Number);
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

async function checkIPBlocklist(ip, ipBlocklistId, db) {
  if (!ipBlocklistId) return null;
  const blocklist = await db.get("SELECT * FROM ip_blocklists WHERE id = $1", [
    ipBlocklistId,
  ]);
  if (!blocklist) return null;

  const ips = blocklist.ips
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  for (const pattern of ips) {
    if (ipMatchesPattern(ip, pattern)) return blocklist;
  }
  return null;
}

async function checkIPAllowlist(ip, ipAllowlistId, db) {
  if (!ipAllowlistId) return null;
  const allowlist = await db.get("SELECT * FROM ip_allowlists WHERE id = $1", [
    ipAllowlistId,
  ]);
  if (!allowlist) return null;

  const ips = allowlist.ips
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  for (const pattern of ips) {
    if (ipMatchesPattern(ip, pattern)) return allowlist;
  }
  return null;
}

/**
 * Resolve an API key → api_keys row → preset.
 * Returns { apiKeyId, preset } or null.
 */
async function resolveApiKey(keyValue, db) {
  const apiKeyRow = await db.get(
    "SELECT * FROM api_keys WHERE api_key = $1",
    [keyValue],
  );
  if (!apiKeyRow) return null;

  const preset = await db.get(
    "SELECT * FROM presets WHERE id = $1",
    [apiKeyRow.preset_id],
  );
  if (!preset) return null;

  // If preset has full access, skip loading join tables
  if (preset.is_full_access) {
    preset.resource_ids = [];
    preset.resource_settings = {};
    preset.endpoint_groups = [];
  } else {
    // Load preset resource_ids and per-resource quota settings
    const resourceRows = await db.all(
      "SELECT resource_id, usage_limit, lease_seconds FROM preset_resources WHERE preset_id = $1",
      [preset.id],
    );
    preset.resource_ids = resourceRows.map((r) => r.resource_id);
    preset.resource_settings = {};
    for (const row of resourceRows) {
      if (row.usage_limit || row.lease_seconds) {
        preset.resource_settings[row.resource_id] = {
          usage_limit: row.usage_limit,
          lease_seconds: row.lease_seconds,
        };
      }
    }

    preset.endpoint_groups = await db.all(
      `SELECT eg.*, peg.lease_seconds, peg.usage_limit
       FROM endpoint_groups eg
       INNER JOIN preset_endpoint_groups peg ON eg.id = peg.endpoint_group_id
       WHERE peg.preset_id = $1`,
      [preset.id],
    );
  }

  return { apiKeyId: apiKeyRow.id, preset };
}

// ── Gateway handler ───────────────────────────────────────────────────
export async function proxy(req, res) {
  const startTime = Date.now();
  const db = getDb();
  const { resourcePath } = req.params;
  const ip =
    req.ip ||
    req.headers["x-forwarded-for"]?.split(",")[0] ||
    req.connection?.remoteAddress ||
    "unknown";

  // Find resource
  const resource = await db.get(
    "SELECT * FROM resources WHERE unique_path = $1",
    [resourcePath],
  );
  if (!resource) {
    throw AppError.notFound("Resource not found");
  }

  // IP logging preference
  const org = await getOrg(db);
  const logIP = org?.log_ip_addresses === 1 ? ip : null;

  const targetUrl = req.query.url;
  if (!targetUrl) {
    throw AppError.badRequest("Missing url parameter");
  }

  // Validate target URL format
  try {
    new URL(targetUrl);
  } catch (_) {
    throw AppError.badRequest("Invalid target URL format");
  }

  // ── Find API key ────────────────────────────────────────────────────
  let apiKey = null;
  const keyPattern = /uc-[a-z0-9]{6}-[A-Za-z0-9]+/;

  // Headers
  for (const [, value] of Object.entries(req.headers)) {
    const match = value?.toString().match(keyPattern);
    if (match) {
      apiKey = match[0];
      break;
    }
  }
  // Query params
  if (!apiKey) {
    for (const [, value] of Object.entries(req.query)) {
      const match = value?.toString().match(keyPattern);
      if (match) {
        apiKey = match[0];
        break;
      }
    }
  }
  // Determine if body content is text-based (safe to inspect/replace)
  const contentType = req.headers["content-type"] || "";
  const isTextContent =
    contentType.includes("json") ||
    contentType.includes("text") ||
    contentType.includes("xml") ||
    contentType.includes("x-www-form-urlencoded");

  const rawBody = Buffer.isBuffer(req.body) ? req.body : null;

  // Guard: if a body was sent but could not be captured as a buffer,
  // log a warning — this can happen if middleware order is wrong.
  if (
    req.headers["content-length"] &&
    parseInt(req.headers["content-length"], 10) > 0 &&
    !rawBody
  ) {
    logger.warn(
      `Gateway received a non-buffer body for ${req.method} ${targetUrl}. ` +
        "Body may have been consumed by another middleware.",
    );
  }

  // Body — only search for API key in text-based content
  if (!apiKey && rawBody && rawBody.length > 0 && isTextContent) {
    const bodyStr = rawBody.toString("utf-8");
    const match = bodyStr.match(keyPattern);
    if (match) apiKey = match[0];
  }

  // ── Reject unauthorized calls without logging ───────────────────────
  if (!apiKey) {
    throw AppError.unauthorized("API key not found");
  }

  // ── Resolve key ────────────────────────────────────────────────────
  const resolved = await resolveApiKey(apiKey, db);
  if (!resolved) {
    throw AppError.unauthorized("Invalid API key");
  }

  const { apiKeyId, preset } = resolved;

  const commonLog = {
    apiKeyId,
    resourceId: resource.id,
    method: req.method,
    url: targetUrl,
    headers: JSON.stringify(req.headers),
    body:
      isTextContent && rawBody ? rawBody.toString("utf-8") : "[binary data]",
    ip: logIP,
    durationMs: null,
    upstreamStatusCode: null,
  };

  // ── Resource access check ──────────────────────────────────────────
  // Full-access presets skip this check entirely
  if (!preset.is_full_access) {
    if (preset.resource_ids.length > 0 && !preset.resource_ids.includes(resource.id)) {
      commonLog.durationMs = Date.now() - startTime;
      logBuffer.push({
        ...commonLog,
        responseCode: 403,
        responseBody: JSON.stringify({ error: "Access to this resource is not allowed by your preset" }),
      });
      throw AppError.forbidden("Access to this resource is not allowed by your preset");
    }
  }

  // ── Method type check ──────────────────────────────────────────────
  if (preset.allowed_methods) {
    const methods = preset.allowed_methods.split(',').map(m => m.trim().toUpperCase());
    if (!methods.includes(req.method.toUpperCase())) {
      commonLog.durationMs = Date.now() - startTime;
      logBuffer.push({
        ...commonLog,
        responseCode: 405,
        responseBody: JSON.stringify({ error: `Method ${req.method} is not allowed by your preset` }),
      });
      throw AppError.methodNotAllowed(`Method ${req.method} is not allowed by your preset`);
    }
  }

  // All controls come from the preset
  const ipAllowlistId = preset?.ip_allowlist_id;
  const ipBlocklistId = preset?.ip_blocklist_id;
  const rateLimitId = preset?.rate_limit_id;

  // ── IP Allowlist ────────────────────────────────────────────────────
  if (ipAllowlistId) {
    const allowlist = await checkIPAllowlist(ip, ipAllowlistId, db);
    if (!allowlist) {
      const allowlistData = await db.get(
        "SELECT * FROM ip_allowlists WHERE id = $1",
        [ipAllowlistId],
      );
      const code = allowlistData?.response_code || 403;
      const body =
        allowlistData?.response_body || '{"error": "IP not allowed"}';
      commonLog.durationMs = Date.now() - startTime;
      logBuffer.push({
        ...commonLog,
        responseCode: code,
        responseBody: body,
      });
      return res.status(code).send(body);
    }
  }

  // ── IP Blocklist ────────────────────────────────────────────────────
  // Design decision: when BOTH an allowlist and blocklist are assigned,
  // the allowlist takes precedence — blocklist is intentionally skipped.
  if (ipBlocklistId && !ipAllowlistId) {
    const blocklist = await checkIPBlocklist(ip, ipBlocklistId, db);
    if (blocklist) {
      commonLog.durationMs = Date.now() - startTime;
      logBuffer.push({
        ...commonLog,
        responseCode: blocklist.response_code,
        responseBody: blocklist.response_body,
      });
      return res.status(blocklist.response_code).send(blocklist.response_body);
    }
  }

  // ── Rate limit ──────────────────────────────────────────────────────
  if (rateLimitId) {
    // Rate-limit keyed by preset
    const rateLimitKey = `preset:${preset.id}`;
    const allowed = await rateLimiter.check(rateLimitKey, rateLimitId, db);
    if (!allowed) {
      const rl = await db.get("SELECT * FROM key_rate_limits WHERE id = $1", [
        rateLimitId,
      ]);
      commonLog.durationMs = Date.now() - startTime;
      logBuffer.push({
        ...commonLog,
        responseCode: rl.response_code,
        responseBody: rl.response_body,
      });
      return res.status(rl.response_code).send(rl.response_body);
    }
  }

  // ── Endpoint groups (skip for full-access presets) ──────────────────
  if (!preset.is_full_access) {
    const allowedGroups = preset?.endpoint_groups || [];

    if (allowedGroups.length > 0) {
      const targetUrlObj = new URL(targetUrl);
      const targetPath = targetUrlObj.pathname;
      const method = req.method.toUpperCase();

      let relativePath = targetPath;
      try {
        const basePath = new URL(resource.external_api_url).pathname.replace(
          /\/$/,
          "",
        );
        if (basePath && basePath !== "/" && targetPath.startsWith(basePath)) {
          relativePath = targetPath.slice(basePath.length) || "/";
        }
      } catch (_) {
        // If the external URL is unparseable, fall back to the full path.
      }

      let matched = false;
      let matchedGroup = null;
      for (const group of allowedGroups) {
        const endpoints = await db.all(
          "SELECT * FROM endpoints WHERE endpoint_group_id = $1",
          [group.id],
        );
        for (const ep of endpoints) {
          const escaped = ep.url_pattern.replace(/([.+?^${}()|[\]\\])/g, "\\$1");
          const pat = escaped.replace(/\*/g, ".*");
          const normPat = pat.startsWith("/") ? pat : `/${pat}`;
          const regex = new RegExp(`^${normPat}$`);
          if (
            (regex.test(relativePath) || regex.test(targetPath)) &&
            ep.method.toUpperCase() === method
          ) {
            matched = true;
            matchedGroup = group;
            break;
          }
        }
        if (matched) break;
      }

      if (!matched) {
        commonLog.durationMs = Date.now() - startTime;
        logBuffer.push({
          ...commonLog,
          responseCode: 403,
          responseBody: JSON.stringify({ error: "Endpoint not allowed" }),
        });
        throw AppError.forbidden("Endpoint not allowed");
      }
    }

    // ── Per-resource expiry & usage checks ─────────────────────────────
    const resourceQuota = preset.resource_settings?.[resource.id];
    if (resourceQuota && (resourceQuota.lease_seconds || resourceQuota.usage_limit)) {
      const resKey = `proj:${resource.id}`;

      // Fetch current quotas from api_key_quotas
      const currentQuotas = await db.get(
        `SELECT usage_counts, expiry_dates FROM api_key_quotas WHERE api_key_id = $1`,
        [apiKeyId],
      );

      // ── Lease / expiry check ──────────────────────────────────────────
      if (resourceQuota.lease_seconds) {
        const existingExpiry = currentQuotas?.expiry_dates?.[resKey];
        if (existingExpiry) {
          // Check if lease has expired
          if (new Date(existingExpiry).getTime() < Date.now()) {
            commonLog.durationMs = Date.now() - startTime;
            logBuffer.push({
              ...commonLog,
              responseCode: 403,
              responseBody: JSON.stringify({ error: "Access expired" }),
            });
            throw AppError.forbidden("Access expired");
          }
        } else {
          // First access — initialize lease (writes directly)
          await usageCounter.initLease(apiKeyId, resource.id, resourceQuota.lease_seconds);
        }
      }

      // ── Usage limit check ─────────────────────────────────────────────
      if (resourceQuota.usage_limit) {
        const dbCount = currentQuotas?.usage_counts?.[resKey] || 0;
        const pendingCount = usageCounter.getPending(apiKeyId, resource.id);
        const totalUsage = dbCount + pendingCount;

        if (totalUsage >= resourceQuota.usage_limit) {
          commonLog.durationMs = Date.now() - startTime;
          logBuffer.push({
            ...commonLog,
            responseCode: 429,
            responseBody: JSON.stringify({ error: "Usage limit exceeded" }),
          });
          return res.status(429).json({ error: "Usage limit exceeded" });
        }
      }

      // Increment usage counter (fire-and-forget, batched)
      usageCounter.increment(apiKeyId, resource.id);
    }
  }

  // ── Replace API key with secret key ─────────────────────────────────
  const secretKey = resource.secret_api_key;
  let headers = { ...req.headers };
  let query = { ...req.query };

  for (const [key, value] of Object.entries(headers)) {
    if (value?.toString().includes(apiKey))
      headers[key] = value.toString().replace(apiKey, secretKey);
  }
  for (const [key, value] of Object.entries(query)) {
    if (value?.toString().includes(apiKey))
      query[key] = value.toString().replace(apiKey, secretKey);
  }
  delete query.url;

  // Replace API key in body only for text-based content; preserve binary data as-is
  let forwardBody = rawBody;
  if (isTextContent && rawBody && rawBody.length > 0) {
    let bodyStr = rawBody.toString("utf-8");
    if (bodyStr.includes(apiKey)) {
      bodyStr = bodyStr.replace(
        new RegExp(apiKey.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"),
        secretKey,
      );
      forwardBody = Buffer.from(bodyStr, "utf-8");
    }
  }

  // ── Forward request ─────────────────────────────────────────────────
  try {
    const timeoutMs = resource.timeout_seconds
      ? resource.timeout_seconds * 1000
      : undefined;

    const hopByHop = [
      "host",
      "connection",
      "content-length",
      "transfer-encoding",
      "accept-encoding",
      "keep-alive",
      "upgrade",
      "expect",
    ];
    const forwardHeaders = { ...headers };
    for (const h of hopByHop) delete forwardHeaders[h];
    // Preserve the original content-type; do NOT force application/json
    // so binary uploads (e.g. Bunny CDN) keep their correct type
    if (!forwardHeaders["content-type"]) {
      forwardHeaders["content-type"] = "application/json";
    }

    const axiosConfig = {
      method: req.method,
      url: targetUrl,
      headers: forwardHeaders,
      params: query,
      data: forwardBody,
      timeout: timeoutMs,
      validateStatus: () => true,
      // Receive response as raw buffer to preserve binary data
      responseType: "arraybuffer",
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    };

    let response;
    try {
      response = await axios(axiosConfig);
    } catch (error) {
      // ── Timeout ───────────────────────────────────────────────────
      if (error.code === "ECONNABORTED" || error.message?.includes("timeout")) {
        const code = resource.timeout_response_code || 504;
        const respBody =
          resource.timeout_response_body || '{"error": "Request timeout"}';
        const respType = resource.timeout_response_type || "json";
        commonLog.durationMs = Date.now() - startTime;
        logBuffer.push({
          ...commonLog,
          responseCode: code,
          responseBody: respBody,
        });
        const ct =
          respType === "json"
            ? "application/json"
            : respType === "xml"
              ? "application/xml"
              : "text/plain";
        res.setHeader("Content-Type", ct);
        return res.status(code).send(respBody);
      }

      // ── DNS / connection refused / network unreachable ─────────────
      if (
        error.code === "ENOTFOUND" ||
        error.code === "ECONNREFUSED" ||
        error.code === "ENETUNREACH" ||
        error.code === "EAI_AGAIN"
      ) {
        const msg = `Upstream unreachable: ${error.code}`;
        logger.warn(`Gateway proxy error for ${targetUrl}: ${msg}`);
        commonLog.durationMs = Date.now() - startTime;
        logBuffer.push({
          ...commonLog,
          responseCode: 502,
          responseBody: JSON.stringify({ error: msg }),
        });
        throw AppError.badGateway(msg, {
          upstreamUrl: targetUrl,
          code: error.code,
        });
      }

      // ── Connection reset by upstream ───────────────────────────────
      if (error.code === "ECONNRESET" || error.code === "EPIPE") {
        const msg = `Upstream connection reset: ${error.code}`;
        logger.warn(`Gateway proxy error for ${targetUrl}: ${msg}`);
        commonLog.durationMs = Date.now() - startTime;
        logBuffer.push({
          ...commonLog,
          responseCode: 502,
          responseBody: JSON.stringify({ error: msg }),
        });
        throw AppError.badGateway(msg, {
          upstreamUrl: targetUrl,
          code: error.code,
        });
      }

      // ── Request body too large (axios maxBodyLength exceeded) ──────
      if (
        error.message?.includes("maxContentLength") ||
        error.message?.includes("maxBodyLength")
      ) {
        commonLog.durationMs = Date.now() - startTime;
        logBuffer.push({
          ...commonLog,
          responseCode: 413,
          responseBody: JSON.stringify({ error: "Payload too large" }),
        });
        throw AppError.payloadTooLarge(
          "Request payload exceeds maximum allowed size",
        );
      }

      // ── Unrecognised axios error ───────────────────────────────────
      logger.error(
        `Gateway proxy unexpected error for ${targetUrl}:`,
        error.message,
      );
      commonLog.durationMs = Date.now() - startTime;
      logBuffer.push({
        ...commonLog,
        responseCode: 502,
        responseBody: JSON.stringify({ error: error.message }),
      });
      throw AppError.badGateway("Failed to reach upstream service", {
        upstreamUrl: targetUrl,
        originalError: error.message,
      });
    }

    // ── Process upstream response ───────────────────────────────────
    const responseContentType = response.headers["content-type"] || "";
    const responseBuffer = Buffer.isBuffer(response.data)
      ? response.data
      : Buffer.from(response.data);

    commonLog.durationMs = Date.now() - startTime;
    commonLog.upstreamStatusCode = response.status;

    // Log the response (text for JSON, placeholder for binary)
    logBuffer.push({
      ...commonLog,
      responseCode: response.status,
      responseBody: responseContentType.includes("json")
        ? responseBuffer.toString("utf-8").slice(0, 10000)
        : "[binary data]",
    });

    // Forward relevant response headers from upstream
    const passthroughHeaders = [
      "content-type",
      "content-disposition",
      "cache-control",
      "etag",
      "last-modified",
    ];
    for (const h of passthroughHeaders) {
      if (response.headers[h]) res.setHeader(h, response.headers[h]);
    }

    res.status(response.status).send(responseBuffer);
  } catch (error) {
    // Only log + re-throw if this is NOT already an AppError we threw above
    if (!(error instanceof AppError)) {
      commonLog.durationMs = Date.now() - startTime;
      logBuffer.push({
        ...commonLog,
        responseCode: 500,
        responseBody: JSON.stringify({ error: error.message }),
      });
    }
    throw error;
  }
}
