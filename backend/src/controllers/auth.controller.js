import {
  generateAdminToken,
  validateAdminToken,
  recordFailedAttempt,
  clearFailedAttempts,
} from "../middleware/auth.js";
import { getDb } from "../db/index.js";
import { AppError } from "../errors/AppError.js";
import { getOrg, updateOrgSetting } from "../services/org.service.js";
import { config } from "../config/index.js";
import speakeasy from "speakeasy";
import bcrypt from "bcryptjs";
import crypto from "crypto";

// ── POST /auth/login ──────────────────────────────────────────────────
// Step 1: Validates password via bcrypt. If 2FA is enabled, returns requires_2fa flag.
// If 2FA is not enabled, returns JWT immediately.
export async function login(req, res) {
  const { password } = req.body;

  const valid = await validateAdminToken(password);
  if (!valid) {
    recordFailedAttempt(req);
    throw AppError.unauthorized("Invalid password");
  }

  clearFailedAttempts(req);

  // Check if 2FA is enabled for the organization
  const db = getDb();
  const org = await getOrg(db);

  const passwordIsInitial = !org?.password_changed_at;

  if (org?.two_factor_enabled) {
    // 2FA is enabled — don't issue JWT yet, require TOTP verification
    return res.json({
      success: true,
      requires_2fa: true,
      password_is_initial: passwordIsInitial,
    });
  }

  // No 2FA — issue JWT directly
  const jwt = generateAdminToken(org?.session_timeout_seconds);
  res.json({
    success: true,
    token: jwt,
    password_is_initial: passwordIsInitial,
  });
}

// ── POST /auth/login/verify-2fa ───────────────────────────────────────
// Step 2: Validates password again + TOTP code. Returns JWT on success.
export async function verify2FA(req, res) {
  const { password, totp_code } = req.body;

  // Re-validate password (prevent bypass)
  const valid = await validateAdminToken(password);
  if (!valid) {
    recordFailedAttempt(req);
    throw AppError.unauthorized("Invalid password");
  }

  clearFailedAttempts(req);

  if (!totp_code) {
    throw AppError.badRequest("2FA verification code is required");
  }

  const db = getDb();
  const org = await getOrg(db);

  if (!org?.two_factor_enabled || !org?.two_factor_secret) {
    throw AppError.badRequest("2FA is not enabled");
  }

  // Verify TOTP code
  const verified = speakeasy.totp.verify({
    secret: org.two_factor_secret,
    encoding: "base32",
    token: totp_code,
    window: 2, // Allow 60-second window for clock drift
  });

  if (!verified) {
    throw AppError.unauthorized("Invalid 2FA verification code");
  }

  const passwordIsInitial = !org?.password_changed_at;

  // TOTP verified — issue JWT
  const jwt = generateAdminToken(org?.session_timeout_seconds);
  res.json({
    success: true,
    token: jwt,
    password_is_initial: passwordIsInitial,
  });
}

// ── POST /auth/reset-password ─────────────────────────────────────────
// Public endpoint: reset admin password using RESET_HASH from env.
export async function resetPassword(req, res) {
  const { reset_hash, new_password } = req.body;

  // Check that RESET_HASH is configured
  if (!config.resetHash) {
    throw AppError.badRequest(
      "Password reset is not configured. Set the RESET_HASH environment variable and restart the server.",
    );
  }

  // Timing-safe comparison of reset_hash against env value
  const expected = Buffer.from(config.resetHash, "utf-8");
  const provided = Buffer.from(reset_hash, "utf-8");

  let hashValid = false;
  if (expected.length === provided.length) {
    hashValid = crypto.timingSafeEqual(expected, provided);
  }

  if (!hashValid) {
    recordFailedAttempt(req);
    throw AppError.unauthorized("Invalid reset credentials");
  }

  // Check that this reset hash hasn't been used before (one-time use)
  const db = getDb();
  const org = await getOrg(db);

  if (org?.last_reset_hash_used === reset_hash) {
    throw AppError.badRequest(
      "This reset hash has already been used. Change the RESET_HASH environment variable to a new value and restart the server.",
    );
  }

  clearFailedAttempts(req);

  // Hash new password and update
  const hash = await bcrypt.hash(new_password, 12);
  await updateOrgSetting("admin_password_hash", hash, db);
  await updateOrgSetting("last_reset_hash_used", reset_hash, db);
  await updateOrgSetting("password_changed_at", new Date().toISOString(), db);

  res.json({
    success: true,
    message: "Password reset successfully. You can now log in with your new password.",
  });
}
