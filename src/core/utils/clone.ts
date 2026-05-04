export function cloneValue<T>(
  obj: T,
  visited: WeakMap<object, unknown> = new WeakMap(),
): T {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  if (typeof structuredClone === "function") {
    try {
      return structuredClone(obj);
    } catch {
      // Alguns runtimes lançam para payloads não suportados (ex.: funções).
      // Nesses casos, seguimos para o clone recursivo para manter fail-open.
    }
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

  if (obj instanceof Map) {
    const clone = new Map<unknown, unknown>();
    visited.set(obj as object, clone);

    obj.forEach((value, key) => {
      clone.set(cloneValue(key, visited), cloneValue(value, visited));
    });

    return clone as T;
  }

  if (obj instanceof Set) {
    const clone = new Set<unknown>();
    visited.set(obj as object, clone);

    obj.forEach((value) => {
      clone.add(cloneValue(value, visited));
    });

    return clone as T;
  }

  if (Array.isArray(obj)) {
    const clone: unknown[] = [];
    visited.set(obj as object, clone);

    for (const item of obj) {
      clone.push(cloneValue(item, visited));
    }

    return clone as T;
  }

  if (ArrayBuffer.isView(obj)) {
    return new (obj.constructor as any)(obj) as T;
  }

  if (obj instanceof ArrayBuffer) {
    return obj.slice(0) as T;
  }

  if (obj instanceof WeakMap || obj instanceof WeakSet) {
    return obj;
  }

  if (obj instanceof Promise) {
    return obj.then((v) => cloneValue(v, new WeakMap())) as T;
  }

  const prototype = Object.getPrototypeOf(obj);
  const isPlainObject = prototype === Object.prototype || prototype === null;

  if (!isPlainObject) {
    const clone = Object.create(prototype) as Record<PropertyKey, unknown>;
    visited.set(obj as object, clone);

    for (const key of Reflect.ownKeys(obj as object)) {
      const descriptor = Object.getOwnPropertyDescriptor(obj as object, key);
      if (!descriptor) {
        continue;
      }

      if ("value" in descriptor) {
        descriptor.value = cloneValue(descriptor.value, visited);
      }

      Object.defineProperty(clone, key, descriptor);
    }

    return clone as T;
  }

  const clone: any = {};
  visited.set(obj as object, clone);

  for (const key of Reflect.ownKeys(obj as object)) {
    if (
      typeof key === "string" &&
      (key === "__proto__" || key === "constructor")
    ) {
      continue;
    }
    const desc = Object.getOwnPropertyDescriptor(obj as object, key);
    if (desc && "value" in desc) {
      clone[key] = cloneValue((obj as any)[key], visited);
    }
  }

  return clone as T;
}
