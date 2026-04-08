export function hasAnyError(errors: Record<string, unknown>): boolean {
  for (const path in errors) {
    if (errors[path]) return true;
  }

  return false;
}
