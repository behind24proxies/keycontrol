/**
 * Shared formatting and validation utilities.
 *
 * Centralises pure functions that were previously duplicated across multiple
 * page components (ProjectsPage, ProjectDetailPage, IPAllowlistsPage,
 * IPBlocklistsPage, PresetsPage).
 */

// Note: API_URL is only used in utils.ts for API calls.
// Gateway URL is now derived from window.location.origin.

// ── URL helpers ──────────────────────────────────────────────────────

/** Build the base URL for gateway proxy requests (copy buttons, curl examples). */
export function getGatewayUrl(): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/gateway`;
  }
  return "/gateway";
}

/**
 * @deprecated Use getGatewayUrl() instead. Kept temporarily for backwards compat.
 */
export function getBackendUrl(): string {
  return getGatewayUrl();
}

// ── Date / time formatting ───────────────────────────────────────────

/** Human-readable relative time string, e.g. "3 hours ago". */
export function formatRelativeTime(dateString: string): string {
  const diffInSeconds = Math.floor(
    (Date.now() - new Date(dateString).getTime()) / 1000,
  );

  // Guard against negative diff (clock skew or very recent timestamps)
  if (diffInSeconds < 0) return "Just now";

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
 * Validate a single IPv4 address, wildcard pattern, or CIDR notation.
 *
 * Supports:
 *  - Plain IPv4 (192.168.1.1)
 *  - Trailing-wildcard patterns (192.168.*.*, 10.*.*.*)
 *  - CIDR notation (192.168.1.0/24, 10.0.0.0/8)
 */
export function validateIP(ip: string): IPValidationResult {
  if (!ip || !ip.trim()) return { valid: false, error: "IP cannot be empty" };

  const ipv4Regex =
    /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

  // ── CIDR notation (e.g. "192.168.1.0/24") ──────────────────────
  if (ip.includes("/")) {
    const parts = ip.split("/");
    if (parts.length !== 2) {
      return { valid: false, error: "Invalid CIDR notation" };
    }
    const [subnet, prefixStr] = parts;
    if (!ipv4Regex.test(subnet.trim())) {
      return { valid: false, error: "Invalid IP address in CIDR notation" };
    }
    const prefix = parseInt(prefixStr, 10);
    if (isNaN(prefix) || prefix < 0 || prefix > 32) {
      return {
        valid: false,
        error: "CIDR prefix must be a number between 0 and 32",
      };
    }
    return { valid: true };
  }

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
  if (!ipv4Regex.test(ip.trim())) {
    return { valid: false, error: "Invalid IP address format" };
  }

  return { valid: true };
}
