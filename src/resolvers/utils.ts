import { BitErrors } from "../core";

export function normalizeErrorPath(path: string): string {
  return path
    .replace(/\[(\d+)\]/g, ".$1")
    .replace(/^\.+/, "")
    .replace(/\.{2,}/g, ".");
}

function matchScopePath(errorPath: string, scopePath: string): boolean {
  return (
    errorPath === scopePath ||
    errorPath.startsWith(`${scopePath}.`) ||
    scopePath.startsWith(`${errorPath}.`)
  );
}

export function setFirstError<T extends object>(
  errors: BitErrors<T>,
  path: string,
  message: string | undefined,
) {
  const normalizedPath = normalizeErrorPath(path);

  if (!normalizedPath || !message) {
    return;
  }

  if (!errors[normalizedPath as keyof BitErrors<T>]) {
    errors[normalizedPath as keyof BitErrors<T>] = message;
  }
}

export function filterErrorsByScope<T extends object>(
  errors: BitErrors<T>,
  scopeFields?: string[],
): BitErrors<T> {
  if (!scopeFields || scopeFields.length === 0) {
    return errors;
  }

  const normalizedScopeFields = scopeFields
    .map((scopeField) => normalizeErrorPath(scopeField))
    .filter((scopeField) => scopeField.length > 0);

  if (normalizedScopeFields.length === 0) {
    return {};
  }

  const filtered: BitErrors<T> = {};

  for (const [key, message] of Object.entries(errors)) {
    const normalizedKey = normalizeErrorPath(key);
    if (
      message &&
      normalizedScopeFields.some((scopeField) =>
        matchScopePath(normalizedKey, scopeField),
      )
    ) {
      const typedKey = key as keyof BitErrors<T>;
      filtered[typedKey] = message as BitErrors<T>[typeof typedKey];
    }
  }

  return filtered;
}
