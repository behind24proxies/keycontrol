import { getDb } from "../db/index.js";
import { generateOrganizationCode, generateMasterKey as createMasterKey } from "../utils/crypto.js";
import { AppError } from "../errors/AppError.js";
import { getOrg, updateOrgSetting } from "../services/org.service.js";
import speakeasy from "speakeasy";
import QRCode from "qrcode";
import bcrypt from "bcryptjs";

// ── GET /organization/profile ─────────────────────────────────────────
export async function getProfile(req, res) {
  const db = getDb();
  const org = await getOrg(db);

  if (!org) {
    throw AppError.notFound("Organization not found");
  }

  let organizationCode = org.organization_code;
  if (!organizationCode) {
    organizationCode = generateOrganizationCode();
    await updateOrgSetting("organization_code", organizationCode, db);
  }

  res.json({
    id: org.id,
    two_factor_enabled: (org.two_factor_enabled ?? 0) === 1,
    session_timeout_seconds: org.session_timeout_seconds || 3600,
    log_ip_addresses: org.log_ip_addresses === 1,
    organization_code: organizationCode,
    master_api_key_prefix: org.master_api_key_prefix || null,
  });
}

// ── PUT /organization/organization-code ───────────────────────────────
export async function updateOrganizationCode(req, res) {
  const db = getDb();
  const { organization_code } = req.body;
  await updateOrgSetting("organization_code", organization_code, db);
  res.json({ success: true, organization_code });
}

// ── POST /organization/two-factor/generate ────────────────────────────
export async function generate2FA(req, res) {
  const db = getDb();

  const secret = speakeasy.generateSecret({
    name: "KeyControl",
    issuer: "KeyControl",
  });

  await updateOrgSetting("two_factor_secret", secret.base32, db);

  const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);
  res.json({
    secret: secret.base32,
    qr_code: qrCodeUrl,
    otpauth_url: secret.otpauth_url,
    manual_entry_key: secret.base32,
  });
}

// ── POST /organization/two-factor/verify ──────────────────────────────
export async function verify2FA(req, res) {
  const db = getDb();
  const { token } = req.body;

  const org = await getOrg(db);
  if (!org?.two_factor_secret) {
    throw AppError.badRequest(
      "2FA secret not found. Please generate a new one.",
    );
  }

  const verified = speakeasy.totp.verify({
    secret: org.two_factor_secret,
    encoding: "base32",
    token,
    window: 2,
  });

  if (!verified) {
    throw AppError.badRequest("Invalid verification code");
  }

  await updateOrgSetting("two_factor_enabled", 1, db);
  res.json({ success: true, message: "2FA enabled successfully" });
}

// ── POST /organization/two-factor/disable ─────────────────────────────
export async function disable2FA(req, res) {
  const db = getDb();
  const { token } = req.body;

  const org = await getOrg(db);
  if (!org?.two_factor_enabled) {
    throw AppError.badRequest("2FA is not enabled");
  }

  if (!token) {
    throw AppError.badRequest("Verification code is required to disable 2FA");
  }

  // Verify TOTP before disabling
  const verified = speakeasy.totp.verify({
    secret: org.two_factor_secret,
    encoding: "base32",
    token,
    window: 2,
  });

  if (!verified) {
    throw AppError.unauthorized("Invalid verification code");
  }

  // Disable 2FA and clear secret
  await updateOrgSetting("two_factor_enabled", 0, db);
  await updateOrgSetting("two_factor_secret", null, db);
  res.json({ success: true, message: "2FA disabled successfully" });
}

// ── PUT /organization/session-timeout ─────────────────────────────────
export async function updateSessionTimeout(req, res) {
  const db = getDb();
  const { session_timeout_seconds } = req.body;
  await updateOrgSetting("session_timeout_seconds", session_timeout_seconds, db);
  res.json({ success: true, session_timeout_seconds });
}

// ── PUT /organization/ip-logging ──────────────────────────────────────
export async function updateIpLogging(req, res) {
  const db = getDb();
  const { log_ip_addresses } = req.body;
  await updateOrgSetting("log_ip_addresses", log_ip_addresses ? 1 : 0, db);
  res.json({ success: true, log_ip_addresses });
}

// ── POST /organization/master-key/generate ────────────────────────────
export async function generateMasterKey(req, res) {
  // Only allow JWT-authenticated admins to generate/regenerate
  if (req.user?.authMethod === "master_key") {
    throw AppError.forbidden("Master key management requires dashboard login");
  }

  const db = getDb();
  const plainKey = createMasterKey();
  const hash = await bcrypt.hash(plainKey, 12);
  const prefix = plainKey.slice(0, 12);

  await updateOrgSetting("master_api_key_hash", hash, db);
  await updateOrgSetting("master_api_key_prefix", prefix, db);

  res.json({
    success: true,
    master_api_key: plainKey,
    prefix,
    message: "Save this key — it will not be shown again.",
  });
}

// ── DELETE /organization/master-key ───────────────────────────────────
export async function revokeMasterKey(req, res) {
  // Only allow JWT-authenticated admins to revoke
  if (req.user?.authMethod === "master_key") {
    throw AppError.forbidden("Master key management requires dashboard login");
  }

  const db = getDb();
  await updateOrgSetting("master_api_key_hash", null, db);
  await updateOrgSetting("master_api_key_prefix", null, db);

  res.json({ success: true, message: "Master API key revoked" });
}
