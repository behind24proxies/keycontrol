import { z } from "zod";

const endpointGroupSettingsSchema = z
  .record(
    z.string(),
    z.object({
      usage_limit: z.number().int().positive().optional().nullable(),
      lease_seconds: z.number().int().positive().optional().nullable(),
    }),
  )
  .optional()
  .default({});

const resourceSettingsSchema = z
  .record(
    z.string(),
    z.object({
      usage_limit: z.number().int().positive().optional().nullable(),
      lease_seconds: z.number().int().positive().optional().nullable(),
    }),
  )
  .optional()
  .default({});

const allowedMethodsSchema = z
  .array(z.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"]))
  .min(1, "At least one method must be allowed")
  .optional();

export const createPresetSchema = z.object({
  body: z.object({
    name: z.string().min(1, "Name is required").max(100),
    description: z.string().max(500).optional().nullable(),
    rate_limit_id: z.number().int().positive().optional().nullable(),
    ip_allowlist_id: z.number().int().positive().optional().nullable(),
    ip_blocklist_id: z.number().int().positive().optional().nullable(),
    endpoint_group_ids: z.array(z.number().int().positive()).optional().default([]),
    resource_ids: z.array(z.number().int().positive()).optional().default([]),
    endpoint_group_settings: endpointGroupSettingsSchema,
    resource_settings: resourceSettingsSchema,
    allowed_methods: allowedMethodsSchema,
  }),
});

export const updatePresetSchema = z.object({
  params: z.object({ id: z.string() }),
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).optional().nullable(),
    rate_limit_id: z.number().int().positive().optional().nullable(),
    ip_allowlist_id: z.number().int().positive().optional().nullable(),
    ip_blocklist_id: z.number().int().positive().optional().nullable(),
    endpoint_group_ids: z.array(z.number().int().positive()).optional(),
    resource_ids: z.array(z.number().int().positive()).optional(),
    endpoint_group_settings: endpointGroupSettingsSchema,
    resource_settings: resourceSettingsSchema,
    allowed_methods: allowedMethodsSchema,
  }),
});

export const duplicatePresetSchema = z.object({
  params: z.object({ id: z.string() }),
});

export const deletePresetSchema = z.object({
  params: z.object({ id: z.string() }),
});

export const batchUpdatePresetsSchema = z.object({
  body: z.object({
    preset_ids: z.array(z.number().int().positive()).min(1),
    resource_ids: z.array(z.number().int().positive()).optional().default([]),
    endpoint_group_ids: z.array(z.number().int().positive()).optional().default([]),
    endpoint_group_settings: endpointGroupSettingsSchema,
    operation: z.enum(["add", "remove"]).optional().default("add"),
  }),
});
