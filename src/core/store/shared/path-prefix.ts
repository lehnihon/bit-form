function stripTrailingSeparators(path: string): string {
  if (path == null) return "";
  return path.replace(/\.+$/g, "");
}

export function normalizePathPrefix(prefix: string): string {
  if (prefix == null) return "";
  return stripTrailingSeparators(prefix.trim());
}

export function isPathWithinPrefix(path: string, prefix: string): boolean {
  if (path == null || prefix == null) return false;
  const normalizedPrefix = normalizePathPrefix(prefix);

  if (normalizedPrefix.length === 0) {
    return false;
  }

  return path === normalizedPrefix || path.startsWith(`${normalizedPrefix}.`);
}

export function toPathPrefix(path: string, index?: number): string {
  if (path == null) return "";
  if (index === undefined) {
    return normalizePathPrefix(path);
  }

  return normalizePathPrefix(`${path}.${index}`);
}
