export function deepClone(obj: any): any {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map((item) => deepClone(item));

  const clone: any = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      clone[key] = deepClone(obj[key]);
    }
  }
  return clone;
}

export function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (
    a === null ||
    typeof a !== "object" ||
    b === null ||
    typeof b !== "object"
  )
    return false;

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

export function setDeepValue(obj: any, path: string, value: any): any {
  if (!path) return value;

  const keys = path.split(".");
  const lastKey = keys.pop()!;

  const helper = (current: any, index: number): any => {
    const key = keys[index];

    if (index === keys.length) {
      if (current?.[lastKey] === value) return current;

      const clone = Array.isArray(current) ? [...current] : { ...current };
      clone[lastKey] = value;
      return clone;
    }

    const currentValue = current?.[key] ?? {};
    const updatedValue = helper(currentValue, index + 1);

    if (current?.[key] === updatedValue) return current;

    const clone = Array.isArray(current) ? [...current] : { ...current };
    clone[key] = updatedValue;
    return clone;
  };

  return helper(obj, 0);
}

export function getDeepValue(obj: any, path: string): any {
  if (!path) return obj;
  const keys = path.split(".");
  let current = obj;
  for (const key of keys) {
    if (current === null || current === undefined) return undefined;
    current = current[key];
  }
  return current;
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
