export function cloneValue<T>(
  obj: T,
  visited: WeakMap<object, unknown> = new WeakMap(),
): T {
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

  if (visited.has(obj as object)) {
    return visited.get(obj as object) as T;
  }

  if (Array.isArray(obj)) {
    const clone: unknown[] = [];
    visited.set(obj as object, clone);

    for (const item of obj) {
      clone.push(cloneValue(item, visited));
    }

    return clone as T;
  }

  const clone: any = {};
  visited.set(obj as object, clone);

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      clone[key] = cloneValue((obj as any)[key], visited);
    }
  }

  return clone as T;
}
