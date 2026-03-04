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
 * Validate the provided password against the org's bcrypt-hashed password.
 *
 * @param {string} password - The password to validate
 * @returns {Promise<boolean>}
 */
export async function validateAdminToken(password) {
  if (!password) return false;

  const org = await getOrg();
  if (!org?.admin_password_hash) return false;

  return bcrypt.compare(password, org.admin_password_hash);
}

// ── In-memory rate limiter for auth endpoints ────────────────────────
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX_ATTEMPTS = 5;
const attempts = new Map(); // ip → { count, firstAttempt }

// Clean up stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of attempts) {
    if (now - data.firstAttempt > RATE_LIMIT_WINDOW_MS) {
      attempts.delete(ip);
    }
  }
}, 5 * 60 * 1000).unref();

/**
 * Rate limiter middleware for login/reset endpoints.
 * Tracks failed attempts per IP. 5 attempts per 15 minutes.
 */
export function loginRateLimiter(req, _res, next) {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const entry = attempts.get(ip);

  if (entry) {
    // Reset window if expired
    if (now - entry.firstAttempt > RATE_LIMIT_WINDOW_MS) {
      attempts.delete(ip);
    } else if (entry.count >= RATE_LIMIT_MAX_ATTEMPTS) {
      const retryAfter = Math.ceil(
        (RATE_LIMIT_WINDOW_MS - (now - entry.firstAttempt)) / 1000,
      );
      throw AppError.tooManyRequests(
        `Too many login attempts. Please try again in ${Math.ceil(retryAfter / 60)} minutes.`,
      );
    }
  }

  next();
}

/**
 * Record a failed auth attempt for rate limiting.
 * Call this after a failed login/reset.
 */
export function recordFailedAttempt(req) {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const entry = attempts.get(ip);

  if (!entry || now - entry.firstAttempt > RATE_LIMIT_WINDOW_MS) {
    attempts.set(ip, { count: 1, firstAttempt: now });
  } else {
    entry.count += 1;
  }
}

/**
 * Clear rate limit tracking for an IP after successful auth.
 */
export function clearFailedAttempts(req) {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  attempts.delete(ip);
}
