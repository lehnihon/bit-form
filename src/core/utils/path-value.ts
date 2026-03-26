const PATH_CACHE_MAX = 5000;
const pathCache = new Map<string, string[]>();

function setPathCacheEntry(path: string, keys: string[]) {
  if (pathCache.has(path)) {
    pathCache.delete(path);
  } else if (pathCache.size >= PATH_CACHE_MAX) {
    const oldestKey = pathCache.keys().next().value;
    if (oldestKey !== undefined) {
      pathCache.delete(oldestKey);
    }
  }

  pathCache.set(path, keys);
}

function getPathKeys(path: string): string[] {
  const cached = pathCache.get(path);
  if (cached) {
    return cached;
  }

  const keys = path.split(".");
  setPathCacheEntry(path, keys);
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

export function unsetDeepValue(obj: any, path: string): any {
  if (!path) {
    return Array.isArray(obj) ? [] : {};
  }

  const keys = getPathKeys(path);
  const root = Array.isArray(obj) ? [...obj] : { ...obj };
  let current: any = root;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    const currentValue = current?.[key];

    if (currentValue === null || currentValue === undefined) {
      return root;
    }

    current[key] = Array.isArray(currentValue)
      ? [...currentValue]
      : { ...currentValue };

    current = current[key];
  }

  const leafKey = keys[keys.length - 1];

  if (Array.isArray(current)) {
    current.splice(Number(leafKey), 1);
  } else if (current && typeof current === "object") {
    delete current[leafKey];
  }

  return root;
}
