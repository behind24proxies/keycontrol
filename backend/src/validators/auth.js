import { z } from "zod";

// Shared password complexity: min 8 chars, at least 1 uppercase, 1 lowercase, 1 digit
const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number");

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
    new_password: passwordSchema,
  }),
});
