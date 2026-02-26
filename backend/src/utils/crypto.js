import crypto from "crypto";

/**
 * Generate a 6-character account code (lowercase alphanumeric).
 */
export function generateOrganizationCode() {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from(crypto.randomBytes(6))
    .map((byte) => chars[byte % chars.length])
    .join("");
}

/**
 * Generate an API key for a key entity (formerly use-case key).
 * Format: uc-{accountCode}-{random46chars}
 */
export function generateApiKey(accountCode) {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const randomString = Array.from(crypto.randomBytes(46))
    .map((byte) => chars[byte % chars.length])
    .join("");
  return `uc-${accountCode}-${randomString}`;
}

/**
 * Generate a master API key for the organization.
 * Format: mk-{random48chars}
 * Distinct "mk-" prefix avoids collision with "uc-" gateway keys.
 */
export function generateMasterKey() {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const randomString = Array.from(crypto.randomBytes(48))
    .map((byte) => chars[byte % chars.length])
    .join("");
  return `mk-${randomString}`;
}
