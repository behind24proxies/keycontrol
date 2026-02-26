import { z } from "zod";

export const createBlocklistSchema = z.object({
  body: z.object({
    name: z.string().min(1, "Name is required"),
    ips: z.string().min(1, "IPs are required"),
    // response_body is the only user-editable response field.
    response_body: z.string().optional().default('{"error": "IP blocked"}'),
    // response_code and response_type are system-controlled (ignored if sent)
    response_code: z.any().optional(),
    response_type: z.any().optional(),
  }),
});

export const updateBlocklistSchema = z.object({
  params: z.object({ id: z.string() }),
  body: z.object({
    name: z.string().min(1, "Name is required"),
    ips: z.string().min(1, "IPs are required"),
    response_body: z.string().optional(),
    response_code: z.any().optional(),
    response_type: z.any().optional(),
  }),
});
