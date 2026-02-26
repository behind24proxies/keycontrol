import { z } from "zod";

export const createRateLimitSchema = z.object({
  body: z.object({
    name: z.string().min(1, "Name is required"),
    rules: z
      .array(
        z.object({
          requests: z.number().int().positive(),
          window_seconds: z.number().int().positive(),
        }),
      )
      .optional()
      .default([]),
    // response_body is the only user-editable response field.
    // It must be valid JSON so the gateway can serve it as application/json.
    response_body: z
      .string()
      .optional()
      .default('{"error": "Rate limit exceeded"}'),
    // response_code and response_type are system-controlled (ignored if sent)
    response_code: z.any().optional(),
    response_type: z.any().optional(),
  }),
});

export const updateRateLimitSchema = z.object({
  params: z.object({ id: z.string() }),
  body: z.object({
    name: z.string().min(1, "Name is required"),
    rules: z
      .array(
        z.object({
          requests: z.number().int().positive(),
          window_seconds: z.number().int().positive(),
        }),
      )
      .optional()
      .default([]),
    response_body: z.string().optional(),
    response_code: z.any().optional(),
    response_type: z.any().optional(),
  }),
});
