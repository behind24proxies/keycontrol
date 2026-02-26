import { generateAdminToken, validateAdminToken } from "../middleware/auth.js";
import { getDb } from "../db/index.js";
import { AppError } from "../errors/AppError.js";
import { getOrg } from "../services/org.service.js";
import speakeasy from "speakeasy";

// ── POST /auth/login ──────────────────────────────────────────────────
// Step 1: Validates ADMIN_TOKEN. If 2FA is enabled, returns requires_2fa flag.
// If 2FA is not enabled, returns JWT immediately.
export async function login(req, res) {
  const { token } = req.body;

  if (!validateAdminToken(token)) {
    throw AppError.unauthorized("Invalid admin token");
  }

  // Check if 2FA is enabled for the organization
  const db = getDb();
  const org = await getOrg(db);

  if (org?.two_factor_enabled) {
    // 2FA is enabled — don't issue JWT yet, require TOTP verification
    return res.json({
      success: true,
      requires_2fa: true,
    });
  }

  // No 2FA — issue JWT directly
  const jwt = generateAdminToken(org?.session_timeout_seconds);
  res.json({
    success: true,
    token: jwt,
  });
}

// ── POST /auth/login/verify-2fa ───────────────────────────────────────
// Step 2: Validates ADMIN_TOKEN again + TOTP code. Returns JWT on success.
export async function verify2FA(req, res) {
  const { token, totp_code } = req.body;

  // Re-validate admin token (prevent bypass)
  if (!validateAdminToken(token)) {
    throw AppError.unauthorized("Invalid admin token");
  }

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

  // TOTP verified — issue JWT
  const jwt = generateAdminToken(org?.session_timeout_seconds);
  res.json({
    success: true,
    token: jwt,
  });
}
