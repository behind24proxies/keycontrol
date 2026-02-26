import { z } from "zod";

// ── Login (admin token authentication) ──────────────────────────────
export const loginSchema = z.object({
  body: z.object({
    token: z.string().min(1, "Admin token is required"),
  }),
});

// ── Login Step 2: 2FA verification ──────────────────────────────────
export const loginVerify2FASchema = z.object({
  body: z.object({
    token: z.string().min(1, "Admin token is required"),
    totp_code: z.string().length(6, "2FA code must be 6 digits"),
  }),
});
