const PATH_CACHE_MAX = 5000;
const pathCache = new Map<string, string[]>();
const BLOCKED_PATH_SEGMENTS = new Set(["__proto__"]);

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

function hasBlockedPathSegment(keys: readonly string[]): boolean {
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];

    if (BLOCKED_PATH_SEGMENTS.has(key)) {
      return true;
    }

    if (key === "constructor" && keys[i + 1] === "prototype") {
      return true;
    }
  }

  return false;
}

export function getDeepValue(obj: any, path: string): any {
  if (!path) return obj;

  const keys = getPathKeys(path);
  if (hasBlockedPathSegment(keys)) return undefined;

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
  if (hasBlockedPathSegment(keys)) return obj;

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

  const safeUpdates = updates.filter(([path]) => {
    const keys = getPathKeys(path);
    return !hasBlockedPathSegment(keys);
  });

  if (safeUpdates.length === 0) {
    return obj;
  }

  const root = Array.isArray(obj) ? [...obj] : { ...obj };
  const clonedNodes = new WeakSet<object>();
  if (root && typeof root === "object") {
    clonedNodes.add(root);
  }

  for (const [path, value] of safeUpdates) {
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
        if (typeof currentValue !== "undefined") {
          console.warn(
            `BitStore: overwriting non-object value at "${keys.slice(0, i).join(".")}"`,
          );
        }
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
  if (hasBlockedPathSegment(keys)) {
    return obj;
  }

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
    const arrayIndex = Number(leafKey);
    // Only splice if leafKey is a valid array index (integer >= 0)
    if (Number.isInteger(arrayIndex) && arrayIndex >= 0) {
      current.splice(arrayIndex, 1);
    }
  } else if (current && typeof current === "object") {
    delete current[leafKey];
  }

  return root;
}

export function unsetDeepValues(obj: any, paths: ReadonlyArray<string>): any {
  if (paths.length === 0) {
    return obj;
  }

  const safePaths = paths.filter((path) => {
    if (!path) return true;
    const keys = getPathKeys(path);
    return !hasBlockedPathSegment(keys);
  });

  if (safePaths.length === 0) {
    return obj;
  }

  const root = Array.isArray(obj) ? [...obj] : { ...obj };
  const clonedNodes = new WeakSet<object>();
  if (root && typeof root === "object") {
    clonedNodes.add(root);
  }

  for (const path of safePaths) {
    if (!path) {
      continue;
    }

    const keys = getPathKeys(path);

    let current: any = root;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      const currentValue = current?.[key];

      if (currentValue === null || currentValue === undefined) {
        current = undefined;
        break;
      }

      if (typeof currentValue === "object") {
        if (!clonedNodes.has(currentValue)) {
          current[key] = Array.isArray(currentValue)
            ? [...currentValue]
            : { ...currentValue };
          clonedNodes.add(current[key]);
        }
      } else {
        current = undefined;
        break;
      }

      current = current[key];
    }

    if (!current) {
      continue;
    }

    const leafKey = keys[keys.length - 1];

    if (Array.isArray(current)) {
      const arrayIndex = Number(leafKey);
      // Only splice if leafKey is a valid array index (integer >= 0)
      if (Number.isInteger(arrayIndex) && arrayIndex >= 0) {
        current.splice(arrayIndex, 1);
      }
    } else if (current && typeof current === "object") {
      delete current[leafKey];
    }
  }

  return root;
}
