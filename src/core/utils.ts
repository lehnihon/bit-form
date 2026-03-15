export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== "object") {
    return obj;
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
  const allKeys = new Set([
    ...Object.keys(obj || {}),
    ...Object.keys(initial || {}),
  ]);
  for (const k of allKeys) {
    const p = prefix ? `${prefix}.${k}` : k;
    collectDirtyPaths((obj as any)?.[k], (initial as any)?.[k], p, result);
  }
  return result;
}

const PATH_CACHE_MAX = 1000;
const pathCache = new Map<string, string[]>();

function getPathKeys(path: string): string[] {
  const cached = pathCache.get(path);
  if (cached) {
    pathCache.delete(path);
    pathCache.set(path, cached);
    return cached;
  }

  const keys = path.split(".");
  if (pathCache.size >= PATH_CACHE_MAX) {
    const oldestKey = pathCache.keys().next().value;
    if (oldestKey) {
      pathCache.delete(oldestKey);
    }
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
  const newObj: Record<string, any> = {};
  const prefix = `${path}.`;

  Object.keys(obj).forEach((key) => {
    if (!key.startsWith(prefix)) {
      newObj[key] = obj[key];
      return;
    }
    const remaining = key.substring(prefix.length);
    const parts = remaining.split(".");
    const currentIdx = parseInt(parts[0], 10);
    const rest = parts.slice(1).join(".");

    if (currentIdx === removedIndex) return;

    if (currentIdx > removedIndex) {
      const newIdx = currentIdx - 1;
      const newKey = rest ? `${prefix}${newIdx}.${rest}` : `${prefix}${newIdx}`;
      newObj[newKey] = obj[key];
    } else {
      newObj[key] = obj[key];
    }
  });
  return newObj;
};

export const swapKeys = (
  obj: Record<string, any>,
  path: string,
  indexA: number,
  indexB: number,
) => {
  const newObj: Record<string, any> = {};
  const prefix = `${path}.`;

  Object.keys(obj).forEach((key) => {
    if (!key.startsWith(prefix)) {
      newObj[key] = obj[key];
      return;
    }
    const remaining = key.substring(prefix.length);
    const parts = remaining.split(".");
    const currentIdx = parseInt(parts[0], 10);
    const rest = parts.slice(1).join(".");

    if (currentIdx === indexA) {
      const newKey = rest ? `${prefix}${indexB}.${rest}` : `${prefix}${indexB}`;
      newObj[newKey] = obj[key];
    } else if (currentIdx === indexB) {
      const newKey = rest ? `${prefix}${indexA}.${rest}` : `${prefix}${indexA}`;
      newObj[newKey] = obj[key];
    } else {
      newObj[key] = obj[key];
    }
  });
  return newObj;
};

export const moveKeys = (
  obj: Record<string, any>,
  path: string,
  from: number,
  to: number,
) => {
  const newObj: Record<string, any> = {};
  const prefix = `${path}.`;

  Object.keys(obj).forEach((key) => {
    if (!key.startsWith(prefix)) {
      newObj[key] = obj[key];
      return;
    }
    const remaining = key.substring(prefix.length);
    const parts = remaining.split(".");
    const currentIdx = parseInt(parts[0], 10);
    const rest = parts.slice(1).join(".");

    let newIdx = currentIdx;
    if (currentIdx === from) {
      newIdx = to;
    } else if (from < to && currentIdx > from && currentIdx <= to) {
      newIdx = currentIdx - 1;
    } else if (from > to && currentIdx >= to && currentIdx < from) {
      newIdx = currentIdx + 1;
    }

    const newKey = rest ? `${prefix}${newIdx}.${rest}` : `${prefix}${newIdx}`;
    newObj[newKey] = obj[key];
  });
  return newObj;
};

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
