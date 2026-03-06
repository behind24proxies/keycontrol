import { z } from "zod";

export const createApiKeySchema = z.object({
  body: z.object({
    name: z.string().min(1, "Name is required").max(100),
    description: z.string().max(500).optional().nullable(),
    notes: z.string().max(1000).optional().nullable(),
    preset_id: z.number().int().positive("Preset is required"),
    usage_limit: z.number().int().positive("Usage limit must be a positive integer").optional().nullable(),
    lease_duration_seconds: z.number().int().positive("Lease duration must be a positive integer").optional().nullable(),
  }),
});

export const updateApiKeySchema = z.object({
  params: z.object({ id: z.string() }),
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).optional().nullable(),
    notes: z.string().max(1000).optional().nullable(),
    preset_id: z.number().int().positive().optional(),
    usage_limit: z.number().int().positive("Usage limit must be a positive integer").optional().nullable(),
    lease_duration_seconds: z.number().int().positive("Lease duration must be a positive integer").optional().nullable(),
  }),
});



export const deleteApiKeySchema = z.object({
  params: z.object({ id: z.string() }),
});
