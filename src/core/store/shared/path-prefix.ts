function stripTrailingSeparators(path: string): string {
  return path.replace(/\.+$/g, "");
}

export function normalizePathPrefix(prefix: string): string {
  return stripTrailingSeparators(prefix.trim());
}

export function isPathWithinPrefix(path: string, prefix: string): boolean {
  const normalizedPrefix = normalizePathPrefix(prefix);

  if (normalizedPrefix.length === 0) {
    return false;
  }

  return path === normalizedPrefix || path.startsWith(`${normalizedPrefix}.`);
}

export function toPathPrefix(path: string, index?: number): string {
  if (index === undefined) {
    return normalizePathPrefix(path);
  }

  return normalizePathPrefix(`${path}.${index}`);
}
