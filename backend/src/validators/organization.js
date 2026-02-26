import { z } from "zod";

export const updateOrganizationCodeSchema = z.object({
  body: z.object({
    organization_code: z
      .string()
      .regex(
        /^[a-z0-9]{6}$/,
        "Organization code must be exactly 6 lowercase letters or numbers",
      ),
  }),
});

export const verify2FASchema = z.object({
  body: z.object({
    token: z.string().length(6, "Verification code must be 6 digits"),
  }),
});

export const disable2FASchema = z.object({
  body: z.object({
    token: z.string().length(6, "Verification code must be 6 digits"),
  }),
});

export const sessionTimeoutSchema = z.object({
  body: z.object({
    session_timeout_seconds: z
      .number()
      .int()
      .min(120, "Session timeout must be at least 120 seconds"),
  }),
});

export const ipLoggingSchema = z.object({
  body: z.object({
    log_ip_addresses: z.boolean(),
  }),
});
