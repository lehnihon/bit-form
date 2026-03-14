import { BitErrors } from "../core";

export function normalizeErrorPath(path: string): string {
  return path.replace(/\[(\d+)\]/g, ".$1");
}

export function setFirstError<T extends object>(
  errors: BitErrors<T>,
  path: string,
  message: string | undefined,
) {
  if (!path || !message) {
    return;
  }

  if (!errors[path as keyof BitErrors<T>]) {
    errors[path as keyof BitErrors<T>] = message;
  }
}

export function filterErrorsByScope<T extends object>(
  errors: BitErrors<T>,
  scopeFields?: string[],
): BitErrors<T> {
  if (!scopeFields || scopeFields.length === 0) {
    return errors;
  }

  const scopeSet = new Set(scopeFields);
  const filtered: BitErrors<T> = {};

  for (const [key, message] of Object.entries(errors)) {
    if (scopeSet.has(key) && message) {
      filtered[key as keyof BitErrors<T>] = message;
    }
  }

  return filtered;
}
