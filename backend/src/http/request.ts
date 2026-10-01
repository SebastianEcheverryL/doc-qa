import type { z } from "zod";

export type ParseResult<T> = { success: true; data: T } | { success: false; errors: string[] };

/**
 * Turns the raw string body of an HTTP request into validated data.
 * Never throws: every problem (missing body, broken JSON, schema violations)
 * comes back as a list of human-readable messages.
 */
export function parseBody<S extends z.ZodType>(schema: S, rawBody: string | undefined): ParseResult<z.output<S>> {
  if (rawBody === undefined || rawBody.trim() === "") {
    return { success: false, errors: ["Request body is required"] };
  }

  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return { success: false, errors: ["Request body must be valid JSON"] };
  }

  const result = schema.safeParse(json);
  if (!result.success) {
    return {
      success: false,
      errors: result.error.issues.map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`),
    };
  }
  return { success: true, data: result.data };
}
