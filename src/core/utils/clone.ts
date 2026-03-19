export function cloneValue<T>(obj: T): T {
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
    return obj.map((item) => cloneValue(item)) as any as T;
  }

  const clone: any = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      clone[key] = cloneValue((obj as any)[key]);
    }
  }

  return clone as T;
}
