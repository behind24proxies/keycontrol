import { z } from "zod";

export const getLogsSchema = z.object({
  query: z.object({
    resource_id: z.string().optional(),
    api_key_id: z.string().optional(),
    method: z.string().optional(),
    status_code: z.string().optional(),
    date_from: z.string().optional(),
    date_to: z.string().optional(),
    page: z.string().optional().default("1"),
    per_page: z.string().optional().default("50"),
  }),
});

export const updateLogSettingsSchema = z.object({
  body: z.object({
    log_ip_addresses: z.boolean().optional(),
    logging_enabled: z.boolean().optional(),
  }),
});
