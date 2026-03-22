export function hasAnyError(errors: Record<string, unknown>): boolean {
  for (const _path in errors) {
    return true;
  }

  return false;
}
