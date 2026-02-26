/**
 * Shared formatting and validation utilities.
 *
 * Centralises pure functions that were previously duplicated across multiple
 * page components (ProjectsPage, ProjectDetailPage, IPAllowlistsPage,
 * IPBlocklistsPage, PresetsPage).
 */

import { API_URL } from "./utils";

// ── URL helpers ──────────────────────────────────────────────────────

/** Derive the gateway root URL from the configured API base URL. */
export function getBackendUrl(): string {
  return API_URL.replace("/api", "");
}

// ── Date / time formatting ───────────────────────────────────────────

/** Human-readable relative time string, e.g. "3 hours ago". */
export function formatRelativeTime(dateString: string): string {
  const diffInSeconds = Math.floor(
    (Date.now() - new Date(dateString).getTime()) / 1000,
  );

  if (diffInSeconds < 60)
    return `${diffInSeconds} second${diffInSeconds !== 1 ? "s" : ""} ago`;

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60)
    return `${diffInMinutes} minute${diffInMinutes !== 1 ? "s" : ""} ago`;

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24)
    return `${diffInHours} hour${diffInHours !== 1 ? "s" : ""} ago`;

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30)
    return `${diffInDays} day${diffInDays !== 1 ? "s" : ""} ago`;

  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12)
    return `${diffInMonths} month${diffInMonths !== 1 ? "s" : ""} ago`;

  const diffInYears = Math.floor(diffInMonths / 12);
  return `${diffInYears} year${diffInYears !== 1 ? "s" : ""} ago`;
}

// ── Rate-limit formatting ────────────────────────────────────────────

/** Compact time-window label: "30sec", "5min", "1hr", "1day". */
export function formatWindow(seconds: number): string {
  if (seconds < 60) return `${seconds}sec`;
  if (seconds < 3600) return `${seconds / 60}min`;
  if (seconds < 86400) return `${seconds / 3600}hr`;
  return `${seconds / 86400}day`;
}

/** Comma-separated rule summary, e.g. "100/1min, 1000/1hr". */
export function formatRuleSummary(
  rules: { requests: number; window_seconds: number }[],
): string {
  if (!rules || rules.length === 0) return "";
  return rules
    .map((r) => `${r.requests}/${formatWindow(r.window_seconds)}`)
    .join(", ");
}

// ── IP validation ────────────────────────────────────────────────────

export interface IPValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate a single IPv4 address or wildcard pattern.
 *
 * Supports:
 *  - Plain IPv4 (192.168.1.1)
 *  - Trailing-wildcard patterns (192.168.*.*, 10.*.*.*)
 */
export function validateIP(ip: string): IPValidationResult {
  if (!ip || !ip.trim()) return { valid: false, error: "IP cannot be empty" };

  // ── Wildcard patterns ───────────────────────────────────────────
  if (ip.includes("*")) {
    const parts = ip.split(".");
    if (parts.length !== 4) {
      return {
        valid: false,
        error: "Wildcard patterns must have exactly 4 parts (e.g., 1.*.*.*)",
      };
    }

    let hasWildcard = false;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (part === "*") {
        hasWildcard = true;
        for (let j = i + 1; j < parts.length; j++) {
          if (parts[j] !== "*") {
            return {
              valid: false,
              error:
                "Wildcards must be at the end (e.g., 1.*.*.*, not 1.*.2.3)",
            };
          }
        }
        break;
      }
      if (part === "") return { valid: false, error: "Empty part in IP address" };
      if (part.includes("*") && part !== "*") {
        return { valid: false, error: "Invalid wildcard format" };
      }
      if (!part.includes("*")) {
        const num = parseInt(part);
        if (isNaN(num) || num < 0 || num > 255) {
          return {
            valid: false,
            error: `Invalid number: ${part} (must be 0-255)`,
          };
        }
      }
    }

    if (!hasWildcard) {
      return {
        valid: false,
        error: "Wildcard pattern must contain at least one *",
      };
    }

    return { valid: true };
  }

  // ── Plain IPv4 ──────────────────────────────────────────────────
  const ipRegex =
    /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  if (!ipRegex.test(ip.trim())) {
    return { valid: false, error: "Invalid IP address format" };
  }

  return { valid: true };
}
