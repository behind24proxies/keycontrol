import { z } from "zod";

export const createEndpointGroupSchema = z.object({
  params: z.object({ resourceId: z.string() }),
  body: z.object({
    name: z.string().min(1, "Name is required"),
    description: z.string().optional().nullable(),
    endpoints: z
      .array(
        z.object({
          url_pattern: z.string().min(1),
          method: z.string().min(1),
        }),
      )
      .optional()
      .default([]),
  }),
});

export const updateEndpointGroupSchema = z.object({
  params: z.object({ id: z.string() }),
  body: z.object({
    name: z.string().min(1, "Name is required"),
    description: z.string().optional().nullable(),
    endpoints: z
      .array(
        z.object({
          url_pattern: z.string().min(1),
          method: z.string().min(1),
        }),
      )
      .optional()
      .default([]),
  }),
});
