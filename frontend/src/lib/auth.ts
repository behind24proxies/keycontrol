const AUTH_TOKEN_KEY = "key-auth-token";

// ── JWT Token management ──────────────────────────────────────────────
export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (typeof window === "undefined") return;
  if (token) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(AUTH_TOKEN_KEY);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────
export function isLoggedIn(): boolean {
  return getToken() !== null;
}

export function logout(): void {
  setToken(null);
}
