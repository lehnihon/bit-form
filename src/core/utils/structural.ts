import { cloneValue } from "./clone";

export function deepClone<T>(obj: T): T {
  return cloneValue(obj);
}

export function deepMerge<T>(target: T, source: any): T {
  if (source === undefined) {
    return deepClone(target);
  }

  if (
    source === null ||
    typeof source !== "object" ||
    source instanceof Date ||
    source instanceof RegExp ||
    Array.isArray(source)
  ) {
    return deepClone(source as T);
  }

  const base =
    target && typeof target === "object" && !Array.isArray(target)
      ? deepClone(target as any)
      : ({} as Record<string, unknown>);

  for (const key of Object.keys(source)) {
    const sourceValue = source[key];
    const baseValue = (base as Record<string, unknown>)[key];

    if (
      sourceValue !== null &&
      typeof sourceValue === "object" &&
      !Array.isArray(sourceValue) &&
      !(sourceValue instanceof Date) &&
      !(sourceValue instanceof RegExp)
    ) {
      (base as Record<string, unknown>)[key] = deepMerge(
        baseValue,
        sourceValue,
      );
      continue;
    }

    (base as Record<string, unknown>)[key] = deepClone(sourceValue);
  }

  return base as T;
}

export function valueEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (
    a === null ||
    typeof a !== "object" ||
    b === null ||
    typeof b !== "object"
  ) {
    return false;
  }
  return deepEqual(a, b);
}

export function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (
    a === null ||
    typeof a !== "object" ||
    b === null ||
    typeof b !== "object"
  ) {
    return false;
  }

  if (a instanceof Date && b instanceof Date)
    return a.getTime() === b.getTime();
  if (a instanceof RegExp && b instanceof RegExp)
    return a.toString() === b.toString();

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (
      !Object.prototype.hasOwnProperty.call(b, key) ||
      !deepEqual(a[key], b[key])
    ) {
      return false;
    }
  }

  return true;
}

export function collectDirtyPaths(
  obj: any,
  initial: any,
  prefix = "",
  result: Set<string> = new Set(),
): Set<string> {
  if (valueEqual(obj, initial)) return result;
  if (
    obj === null ||
    typeof obj !== "object" ||
    initial === null ||
    typeof initial !== "object"
  ) {
    if (prefix) result.add(prefix);
    return result;
  }
  if (Array.isArray(obj) || Array.isArray(initial)) {
    if (!valueEqual(obj, initial) && prefix) result.add(prefix);
    return result;
  }
  const allKeys = new Set<string>();
  for (const key of Object.keys(obj || {})) {
    allKeys.add(key);
  }
  for (const key of Object.keys(initial || {})) {
    allKeys.add(key);
  }
  for (const k of allKeys) {
    const p = prefix ? `${prefix}.${k}` : k;
    collectDirtyPaths((obj as any)?.[k], (initial as any)?.[k], p, result);
  }
  return result;
}
