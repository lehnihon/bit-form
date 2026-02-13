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
    if (!keysB.includes(key) || !deepEqual(a[key], b[key])) return false;
  }

  return true;
}

export function getDeepValue(obj: any, path: string): any {
  return path.split(".").reduce((prev, curr) => prev?.[curr], obj);
}

export function setDeepValue(obj: any, path: string, value: any): any {
  const keys = path.split(".");
  const lastKey = keys.pop()!;
  // Clona o array se for array, ou objeto se for objeto
  const newObj = Array.isArray(obj) ? [...obj] : { ...obj };

  let current = newObj;
  for (const key of keys) {
    if (!current[key]) current[key] = {};
    // Garante imutabilidade no caminho
    current[key] = Array.isArray(current[key])
      ? [...current[key]]
      : { ...current[key] };
    current = current[key];
  }

  current[lastKey] = value;
  return newObj;
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
