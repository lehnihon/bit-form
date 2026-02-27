/**
 * Checks if a value looks like a server validation error response.
 * Handles shapes like { email: "Taken" }, { errors: { email: ["Taken"] } }, etc.
 */
export function isValidationErrorShape(x: unknown): x is Record<string, string | string[]> {
  if (typeof x !== "object" || x === null || Array.isArray(x)) return false;

  const obj = (x as Record<string, unknown>).errors ?? x;
  if (typeof obj !== "object" || obj === null || Array.isArray(obj)) return false;

  return Object.values(obj as Record<string, unknown>).every(
    (v) => typeof v === "string" || (Array.isArray(v) && v.every((i) => typeof i === "string")),
  );
}

/**
 * Extracts server errors in the format expected by setServerErrors.
 */
export function extractServerErrors(x: unknown): Record<string, string | string[]> {
  if (!isValidationErrorShape(x)) return {};

  const obj = (x as Record<string, unknown>).errors ?? x;
  return obj as Record<string, string | string[]>;
}
