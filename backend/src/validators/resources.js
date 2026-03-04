import { z } from "zod";

const responseTypeEnum = z
  .enum(["json", "text", "xml"])
  .optional()
  .default("json");

export const createResourceSchema = z.object({
  body: z
    .object({
      name: z.string().min(1, "Name is required"),
      unique_path: z.string().min(1, "Unique path is required"),
      secret_api_key: z.string().min(1, "Secret API key is required"),
      external_api_base_url: z.string().min(1).optional(),
      external_api_url: z.string().min(1).optional(),
      description: z.string().optional().nullable(),
      timeout_seconds: z.number().int().positive().optional().nullable(),
      timeout_response_code: z.number().int().optional().default(504),
      timeout_response_body: z
        .string()
        .optional()
        .default('{"error": "Request timeout"}'),
      timeout_response_type: responseTypeEnum,
    })
    .refine((data) => data.external_api_base_url || data.external_api_url, {
      message: "Either external_api_base_url or external_api_url is required",
    }),
});

export const updateResourceSchema = z.object({
  params: z.object({ id: z.string() }),
  body: z
    .object({
      name: z.string().min(1, "Name is required"),
      secret_api_key: z.string().min(1, "Secret API key is required"),
      external_api_base_url: z.string().min(1).optional(),
      external_api_url: z.string().min(1).optional(),
      description: z.string().optional().nullable(),
      timeout_seconds: z.number().int().positive().optional().nullable(),
      timeout_response_code: z.number().int().optional().default(504),
      timeout_response_body: z
        .string()
        .optional()
        .default('{"error": "Request timeout"}'),
      timeout_response_type: responseTypeEnum,
    })
    .refine((data) => data.external_api_base_url || data.external_api_url, {
      message: "Either external_api_base_url or external_api_url is required",
    }),
});
