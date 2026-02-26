import { AppError } from "../errors/AppError.js";

/**
 * Create Express middleware that validates request data against a Zod schema.
 *
 * The schema should be a z.object with optional keys: body, query, params.
 * On success the parsed (coerced / defaulted) values replace the originals.
 * On failure an AppError.validation is thrown (handled by the global error handler).
 *
 * @param {import('zod').ZodSchema} schema
 */
export function validate(schema) {
  return (req, _res, next) => {
    const result = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    if (!result.success) {
      throw AppError.validation(
        result.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      );
    }

    // Replace with parsed / coerced values
    if (result.data.body !== undefined) req.body = result.data.body;
    if (result.data.query !== undefined) req.query = result.data.query;
    if (result.data.params !== undefined) req.params = result.data.params;

    next();
  };
}
