export function hasAnyError(errors: Record<string, unknown>): boolean {
  for (const path of Object.keys(errors)) {
    if (errors[path] !== undefined) return true;
  }

  return false;
}
