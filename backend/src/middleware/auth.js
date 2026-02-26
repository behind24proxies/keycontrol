import jwt from "jsonwebtoken";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { config } from "../config/index.js";
import { AppError } from "../errors/AppError.js";
import { getOrg } from "../services/org.service.js";

/**
 * Express middleware that validates Bearer tokens for admin dashboard.
 *
 * Supports two token types:
 *   1. Master API key (prefix "mk-") — validated via bcrypt against org hash
 *   2. JWT (default) — validated via jwt.verify
 *
 * Sets req.user = { role, authMethod } so handlers can distinguish.
 */
export function authenticate(req, _res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw AppError.unauthorized("Authentication required");
  }

  const token = authHeader.slice(7);

  // ── Master key path (async — bcrypt compare) ─────────────────────
  if (token.startsWith("mk-")) {
    return (async () => {
      const org = await getOrg();
      if (!org?.master_api_key_hash) {
        throw AppError.unauthorized("Master API key not configured");
      }
      const valid = await bcrypt.compare(token, org.master_api_key_hash);
      if (!valid) {
        throw AppError.unauthorized("Invalid master API key");
      }
      req.user = { role: "admin", authMethod: "master_key" };
      next();
    })().catch(next);
  }

  // ── JWT path (synchronous) ───────────────────────────────────────
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    req.user = { role: payload.role || "admin", authMethod: "jwt" };
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      throw AppError.unauthorized("Token expired");
    }
    throw AppError.unauthorized("Invalid token");
  }
}

/**
 * Generate a short-lived JWT for admin sessions.
 * @param {number} [ttlSeconds] — organisation's session_timeout_seconds.
 *   Falls back to config.jwtExpiresIn (env JWT_EXPIRES_IN, default "1h").
 */
export function generateAdminToken(ttlSeconds) {
  return jwt.sign(
    {
      role: "admin",
      // Include a random jti to prevent token reuse attacks
      jti: crypto.randomBytes(16).toString("hex"),
    },
    config.jwtSecret,
    { expiresIn: ttlSeconds ? `${ttlSeconds}s` : config.jwtExpiresIn },
  );
}

/**
 * Validate the provided admin token against the configured ADMIN_TOKEN.
 * Uses timing-safe comparison to prevent timing attacks.
 *
 * @param {string} token - The token to validate
 * @returns {boolean}
 */
export function validateAdminToken(token) {
  if (!config.adminToken || !token) return false;

  const expected = Buffer.from(config.adminToken, "utf-8");
  const provided = Buffer.from(token, "utf-8");

  if (expected.length !== provided.length) return false;

  return crypto.timingSafeEqual(expected, provided);
}
