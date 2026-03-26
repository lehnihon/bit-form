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
