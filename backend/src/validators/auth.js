import { z } from "zod";

// ── Login (password authentication) ──────────────────────────────────
export const loginSchema = z.object({
  body: z.object({
    password: z.string().min(1, "Password is required"),
  }),
});

// ── Login Step 2: 2FA verification ──────────────────────────────────
export const loginVerify2FASchema = z.object({
  body: z.object({
    password: z.string().min(1, "Password is required"),
    totp_code: z.string().length(6, "2FA code must be 6 digits"),
  }),
});

// ── Password reset (public, requires RESET_HASH env) ────────────────
export const resetPasswordSchema = z.object({
  body: z.object({
    reset_hash: z.string().min(1, "Reset hash is required"),
    new_password: z.string().min(8, "Password must be at least 8 characters"),
  }),
});
