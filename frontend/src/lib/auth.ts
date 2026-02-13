const CURRENT_ACCOUNT_KEY = 'key-current-account';

export interface CurrentAccount {
  id: number;
  username: string;
  two_factor_enabled?: boolean;
  session_timeout_seconds?: number;
}

export function getCurrentAccount(): CurrentAccount | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(CURRENT_ACCOUNT_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

export function setCurrentAccount(account: CurrentAccount | null): void {
  if (typeof window === 'undefined') return;
  if (account) {
    localStorage.setItem(CURRENT_ACCOUNT_KEY, JSON.stringify(account));
  } else {
    localStorage.removeItem(CURRENT_ACCOUNT_KEY);
  }
  // Dispatch event for other components to listen
  window.dispatchEvent(new Event('account-changed'));
}

export function logout(): void {
  setCurrentAccount(null);
  // Clear session start time
  localStorage.removeItem('key-session-start-time');
}

// Legacy functions for backward compatibility (for API key users)
export interface CurrentUser {
  id: number;
  first_name: string;
  last_name: string;
  email?: string;
  color?: string;
}

export function getCurrentUser(): CurrentUser | null {
  // This is for API key users, not system accounts
  return null;
}

export function setCurrentUser(user: CurrentUser | null): void {
  // This is for API key users, not system accounts
  // Do nothing - use setCurrentAccount instead
}
