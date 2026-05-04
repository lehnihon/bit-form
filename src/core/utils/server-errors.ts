export function isValidationErrorShape(
  x: unknown,
): x is Record<string, string | string[]> {
  if (typeof x !== "object" || x === null || Array.isArray(x)) return false;

  const obj = (x as Record<string, unknown>).errors ?? x;
  if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    return false;
  }

  const entries = Object.entries(obj as Record<string, unknown>);
  if (entries.length === 0) {
    return false;
  }

  return entries.every(
    ([key, v]) =>
      key.length > 0 &&
      (typeof v === "string" ||
        (Array.isArray(v) && v.every((i) => typeof i === "string")) ||
        (typeof v === "object" && v !== null && "message" in v &&
          typeof (v as Record<string, unknown>).message === "string")),
  );
}

export function extractServerErrors(
  x: unknown,
): Record<string, string | string[]> {
  if (!isValidationErrorShape(x)) return {};

  const obj = (x as Record<string, unknown>).errors ?? x;
  return obj as Record<string, string | string[]>;
}
