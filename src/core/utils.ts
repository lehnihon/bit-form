export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  if (typeof structuredClone === "function") {
    return structuredClone(obj);
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime()) as any as T;
  }
  if (obj instanceof RegExp) {
    return new RegExp(obj.source, obj.flags) as any as T;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => deepClone(item)) as any as T;
  }

  const clone: any = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      clone[key] = deepClone((obj as any)[key]);
    }
  }
  return clone as T;
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

/**
 * Fast equality for single values. Uses === for primitives, deepEqual for objects/arrays.
 * Prefer over deepEqual when comparing a single field value (e.g. isFieldDirty, getStepStatus).
 */
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

/**
 * Collects all paths where obj differs from initial. Used to rebuild dirtyPaths after full state replacement.
 */
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

/**
 * Path keys cache configuration
 *
 * Caching the split path strings prevents repeated string splitting operations.
 * This is especially important in hotspots like setField(), getDeepValue(), and
 * field change detection where the same paths are accessed repeatedly.
 *
 * Cache size: 5000 entries
 * When cache reaches capacity, it's cleared (rotational eviction strategy)
 * Typical hit rate: >80% in most forms with 100-1000 fields
 */
const PATH_CACHE_MAX = 5000;
const pathCache = new Map<string, string[]>();

function getPathKeys(path: string): string[] {
  const cached = pathCache.get(path);
  if (cached) {
    return cached;
  }

  const keys = path.split(".");
  if (pathCache.size >= PATH_CACHE_MAX) {
    pathCache.clear();
  }
  pathCache.set(path, keys);
  return keys;
}

export function getDeepValue(obj: any, path: string): any {
  if (!path) return obj;

  const keys = getPathKeys(path);

  let current = obj;
  for (const key of keys) {
    if (current === null || current === undefined) return undefined;
    current = current[key];
  }
  return current;
}

export function setDeepValue(obj: any, path: string, value: any): any {
  if (!path) return value;

  const keys = getPathKeys(path);

  const result = Array.isArray(obj) ? [...obj] : { ...obj };
  let current = result;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    const nextKey = keys[i + 1];

    const nextAsNumber = Number(nextKey);
    const isNextNumeric =
      Number.isInteger(nextAsNumber) && String(nextAsNumber) === nextKey;
    const currentValue = current[key];

    if (currentValue === null || currentValue === undefined) {
      current[key] = isNextNumeric ? [] : {};
    } else {
      current[key] = Array.isArray(currentValue)
        ? [...currentValue]
        : { ...currentValue };
    }

    current = current[key];
  }

  current[keys[keys.length - 1]] = value;

  return result;
}

export function setDeepValues(
  obj: any,
  updates: ReadonlyArray<readonly [path: string, value: any]>,
): any {
  if (updates.length === 0) {
    return obj;
  }

  const root = Array.isArray(obj) ? [...obj] : { ...obj };
  const clonedNodes = new WeakSet<object>();
  if (root && typeof root === "object") {
    clonedNodes.add(root);
  }

  for (const [path, value] of updates) {
    const keys = getPathKeys(path);
    let current: any = root;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      const nextKey = keys[i + 1];

      const nextAsNumber = Number(nextKey);
      const isNextNumeric =
        Number.isInteger(nextAsNumber) && String(nextAsNumber) === nextKey;

      const currentValue = current[key];

      if (currentValue === null || currentValue === undefined) {
        current[key] = isNextNumeric ? [] : {};
        clonedNodes.add(current[key]);
      } else if (typeof currentValue === "object") {
        if (!clonedNodes.has(currentValue)) {
          current[key] = Array.isArray(currentValue)
            ? [...currentValue]
            : { ...currentValue };
          clonedNodes.add(current[key]);
        }
      } else {
        current[key] = isNextNumeric ? [] : {};
        clonedNodes.add(current[key]);
      }

      current = current[key];
    }

    current[keys[keys.length - 1]] = value;
  }

  return root;
}

export function cleanPrefixedKeys(
  obj: Record<string, any>,
  prefix: string,
): Record<string, any> {
  const newObj: Record<string, any> = {};
  const prefixWithDot = `${prefix}.`;

  for (const key in obj) {
    if (key !== prefix && !key.startsWith(prefixWithDot)) {
      newObj[key] = obj[key];
    }
  }
  return newObj;
}

export const shiftKeys = (
  obj: Record<string, any>,
  path: string,
  removedIndex: number,
) => {
  return reindexObjectKeys(obj, path, (currentIdx) => {
    if (currentIdx === removedIndex) {
      return null;
    }

    return currentIdx > removedIndex ? currentIdx - 1 : currentIdx;
  });
};

export const swapKeys = (
  obj: Record<string, any>,
  path: string,
  indexA: number,
  indexB: number,
) => {
  return reindexObjectKeys(obj, path, (currentIdx) => {
    if (currentIdx === indexA) {
      return indexB;
    }

    if (currentIdx === indexB) {
      return indexA;
    }

    return currentIdx;
  });
};

export const moveKeys = (
  obj: Record<string, any>,
  path: string,
  from: number,
  to: number,
) => {
  return reindexObjectKeys(obj, path, (currentIdx) => {
    if (currentIdx === from) {
      return to;
    }

    if (from < to && currentIdx > from && currentIdx <= to) {
      return currentIdx - 1;
    }

    if (from > to && currentIdx >= to && currentIdx < from) {
      return currentIdx + 1;
    }

    return currentIdx;
  });
};

export function reindexFieldArrayMeta(
  state: {
    errors: Record<string, any>;
    touched: Record<string, any>;
    isValidating: Record<string, any>;
  },
  path: string,
  remapIndex: (index: number) => number | null,
) {
  const nextErrors: Record<string, any> = {};
  const nextTouched: Record<string, any> = {};
  const nextIsValidating: Record<string, any> = {};

  const prefix = `${path}.`;

  // Iterate each dictionary directly to avoid building a union Set of all keys.
  for (const key of Object.keys(state.errors)) {
    const nextKey = remapIndexedPath(key, prefix, remapIndex);
    if (nextKey) nextErrors[nextKey] = state.errors[key];
  }

  for (const key of Object.keys(state.touched)) {
    const nextKey = remapIndexedPath(key, prefix, remapIndex);
    if (nextKey) nextTouched[nextKey] = state.touched[key];
  }

  for (const key of Object.keys(state.isValidating)) {
    const nextKey = remapIndexedPath(key, prefix, remapIndex);
    if (nextKey) nextIsValidating[nextKey] = state.isValidating[key];
  }

  return {
    errors: nextErrors,
    touched: nextTouched,
    isValidating: nextIsValidating,
  };
}

function remapIndexedPath(
  key: string,
  prefix: string,
  remapIndex: (index: number) => number | null,
) {
  if (!key.startsWith(prefix)) {
    return key;
  }

  const remaining = key.substring(prefix.length);
  const parts = remaining.split(".");
  const currentIdx = parseInt(parts[0], 10);
  const nextIdx = remapIndex(currentIdx);

  if (nextIdx === null) {
    return null;
  }

  const rest = parts.slice(1).join(".");
  return rest ? `${prefix}${nextIdx}.${rest}` : `${prefix}${nextIdx}`;
}

function reindexObjectKeys(
  obj: Record<string, any>,
  path: string,
  remapIndex: (index: number) => number | null,
) {
  const nextObject: Record<string, any> = {};
  const prefix = `${path}.`;

  for (const key of Object.keys(obj)) {
    if (!key.startsWith(prefix)) {
      nextObject[key] = obj[key];
      continue;
    }

    const remaining = key.substring(prefix.length);
    const parts = remaining.split(".");
    const currentIdx = parseInt(parts[0], 10);
    const nextIdx = remapIndex(currentIdx);

    if (nextIdx === null) {
      continue;
    }

    const rest = parts.slice(1).join(".");
    const nextKey = rest
      ? `${prefix}${nextIdx}.${rest}`
      : `${prefix}${nextIdx}`;
    nextObject[nextKey] = obj[key];
  }

  return nextObject;
}

/**
 * Checks if a value looks like a server validation error response.
 * Handles shapes like { email: "Taken" }, { errors: { email: ["Taken"] } }, etc.
 */
export function isValidationErrorShape(
  x: unknown,
): x is Record<string, string | string[]> {
  if (typeof x !== "object" || x === null || Array.isArray(x)) return false;

  const obj = (x as Record<string, unknown>).errors ?? x;
  if (typeof obj !== "object" || obj === null || Array.isArray(obj))
    return false;

  return Object.values(obj as Record<string, unknown>).every(
    (v) =>
      typeof v === "string" ||
      (Array.isArray(v) && v.every((i) => typeof i === "string")),
  );
}

/**
 * Extracts server errors in the format expected by setServerErrors.
 */
export function extractServerErrors(
  x: unknown,
): Record<string, string | string[]> {
  if (!isValidationErrorShape(x)) return {};

  const obj = (x as Record<string, unknown>).errors ?? x;
  return obj as Record<string, string | string[]>;
}
