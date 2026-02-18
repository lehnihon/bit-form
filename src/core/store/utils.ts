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

const pathCache = new Map<string, string[]>();

export function getDeepValue(obj: any, path: string): any {
  if (!path) return obj;

  const keys = pathCache.get(path) || path.split(".");
  if (!pathCache.has(path)) pathCache.set(path, keys);

  let current = obj;
  for (const key of keys) {
    if (current === null || current === undefined) return undefined;
    current = current[key];
  }
  return current;
}

export function setDeepValue(obj: any, path: string, value: any): any {
  if (!path) return value;

  const keys = pathCache.get(path) || path.split(".");
  if (!pathCache.has(path)) pathCache.set(path, keys);

  const result = Array.isArray(obj) ? [...obj] : { ...obj };
  let current = result;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    const nextKey = keys[i + 1];

    const isNextNumeric = /^\d+$/.test(nextKey);
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
