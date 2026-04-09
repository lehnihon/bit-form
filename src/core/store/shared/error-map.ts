export function hasAnyError(errors: Record<string, unknown>): boolean {
  for (const path in errors) {
    if (errors[path] !== undefined) return true;
  }

  return false;
}
