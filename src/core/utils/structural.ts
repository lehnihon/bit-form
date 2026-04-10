import { cloneValue } from "./clone";

export function deepClone<T>(obj: T): T {
  return cloneValue(obj);
}

export function deepMerge<T>(
  target: T,
  source: any,
  activeMerges: WeakMap<object, unknown> = new WeakMap(),
): T {
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

  const sourceObject = source as object;
  if (activeMerges.has(sourceObject)) {
    return activeMerges.get(sourceObject) as T;
  }

  const base =
    target && typeof target === "object" && !Array.isArray(target)
      ? deepClone(target as any)
      : ({} as Record<string, unknown>);

  activeMerges.set(sourceObject, base);

  try {
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
          activeMerges,
        );
        continue;
      }

      (base as Record<string, unknown>)[key] = deepClone(sourceValue);
    }
  } finally {
    activeMerges.delete(sourceObject);
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
  return deepEqualInner(a, b, new WeakMap());
}

function deepEqualInner(
  a: any,
  b: any,
  visitedPairs: WeakMap<object, WeakSet<object>>,
): boolean {
  if (a === b) return true;
  if (
    a === null ||
    typeof a !== "object" ||
    b === null ||
    typeof b !== "object"
  ) {
    return false;
  }

  const visitedTargets = visitedPairs.get(a);
  if (visitedTargets?.has(b)) return true;

  if (visitedTargets) {
    visitedTargets.add(b);
  } else {
    visitedPairs.set(a, new WeakSet([b]));
  }

  if (Array.isArray(a) !== Array.isArray(b)) return false;

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
      !deepEqualInner(a[key], b[key], visitedPairs)
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
  activePairs: Map<object, Set<object>> = new Map(),
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

  const activeInitials = activePairs.get(obj as object);
  if (activeInitials?.has(initial as object)) {
    return result;
  }

  if (activeInitials) {
    activeInitials.add(initial as object);
  } else {
    activePairs.set(obj as object, new Set([initial as object]));
  }

  try {
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
      collectDirtyPaths(
        (obj as any)?.[k],
        (initial as any)?.[k],
        p,
        result,
        activePairs,
      );
    }
    return result;
  } finally {
    const nextActiveInitials = activePairs.get(obj as object);
    nextActiveInitials?.delete(initial as object);

    if (nextActiveInitials && nextActiveInitials.size === 0) {
      activePairs.delete(obj as object);
    }
  }
}
