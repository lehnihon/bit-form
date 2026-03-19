import type { BitErrors, BitState } from "../contracts/types";

function isObjectLike(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function collectChangedValuePaths(args: {
  previousValue: unknown;
  nextValue: unknown;
  basePath: string;
  changedPaths: Set<string>;
}): void {
  const { previousValue, nextValue, basePath, changedPaths } = args;

  if (Object.is(previousValue, nextValue)) {
    return;
  }

  const previousIsObject = isObjectLike(previousValue);
  const nextIsObject = isObjectLike(nextValue);

  if (!previousIsObject || !nextIsObject) {
    if (basePath.length > 0) {
      changedPaths.add(basePath);
    }
    return;
  }

  if (Array.isArray(previousValue) || Array.isArray(nextValue)) {
    const previousArray = Array.isArray(previousValue) ? previousValue : [];
    const nextArray = Array.isArray(nextValue) ? nextValue : [];
    const maxLength = Math.max(previousArray.length, nextArray.length);

    for (let index = 0; index < maxLength; index += 1) {
      const childPath =
        basePath.length > 0 ? `${basePath}.${index}` : `${index}`;
      collectChangedValuePaths({
        previousValue: previousArray[index],
        nextValue: nextArray[index],
        basePath: childPath,
        changedPaths,
      });
    }

    if (previousArray.length !== nextArray.length && basePath.length > 0) {
      changedPaths.add(basePath);
    }

    return;
  }

  const previousObject = previousValue as Record<string, unknown>;
  const nextObject = nextValue as Record<string, unknown>;
  const keys = new Set<string>([
    ...Object.keys(previousObject),
    ...Object.keys(nextObject),
  ]);

  if (keys.size === 0 && basePath.length > 0) {
    changedPaths.add(basePath);
    return;
  }

  keys.forEach((key) => {
    const childPath = basePath.length > 0 ? `${basePath}.${key}` : key;
    collectChangedValuePaths({
      previousValue: previousObject[key],
      nextValue: nextObject[key],
      basePath: childPath,
      changedPaths,
    });
  });
}

function normalizeErrors<T extends object>(errors: BitErrors<T>): BitErrors<T> {
  let hasUndefined = false;

  for (const message of Object.values(errors)) {
    if (message === undefined) {
      hasUndefined = true;
      break;
    }
  }

  if (!hasUndefined) {
    return errors;
  }

  const normalized: BitErrors<T> = {};

  Object.entries(errors).forEach(([path, message]) => {
    if (message === undefined) {
      return;
    }

    normalized[path as keyof BitErrors<T>] = message as any;
  });

  return normalized;
}

export interface BitStateUpdateResult<T extends object> {
  nextState: BitState<T>;
  changedPaths?: string[];
  valuesChanged: boolean;
}

function hasErrors(errors: Record<string, unknown>) {
  for (const _path in errors) {
    return true;
  }

  return false;
}

export function applyStateUpdate<T extends object>(args: {
  currentState: BitState<T>;
  partialState: Partial<BitState<T>>;
  changedPaths?: string[];
  applyComputedValues: (values: T) => T;
  inferValueChangedPaths?: boolean;
}): BitStateUpdateResult<T> {
  const {
    currentState,
    partialState,
    changedPaths,
    applyComputedValues,
    inferValueChangedPaths = true,
  } = args;

  const nextState: BitState<T> = { ...currentState, ...partialState };
  const valuesChanged = !!partialState.values;

  if (partialState.values) {
    nextState.values = applyComputedValues(partialState.values);
  }

  if (partialState.errors) {
    nextState.errors = normalizeErrors(partialState.errors as BitErrors<T>);
    nextState.isValid = !hasErrors(nextState.errors as Record<string, unknown>);
  }

  const explicitChangedPaths =
    changedPaths && changedPaths.length > 0 ? changedPaths : undefined;
  const inferredChangedPaths = inferChangedPaths(
    currentState,
    partialState,
    !explicitChangedPaths && inferValueChangedPaths,
  );
  const effectiveChangedPaths = mergeChangedPaths(
    explicitChangedPaths,
    inferredChangedPaths,
  );

  return {
    nextState,
    changedPaths: effectiveChangedPaths,
    valuesChanged,
  };
}

function inferChangedPaths<T extends object>(
  currentState: BitState<T>,
  partialState: Partial<BitState<T>>,
  includeValueDiff: boolean,
): string[] | undefined {
  const changedPaths = new Set<string>();

  // If values are explicitly changed without path information, infer from object keys
  // instead of using wildcard ["*"] which notifies all path subscribers.
  // This provides granular notifications for better performance in large forms.
  if (includeValueDiff && partialState.values) {
    collectChangedValuePaths({
      previousValue: currentState.values,
      nextValue: partialState.values,
      basePath: "",
      changedPaths,
    });
  }

  // Itera os três dicionários de path em único passo para evitar
  // três Object.keys() + três forEach() separados.
  const pathMaps = [
    partialState.errors,
    partialState.touched,
    partialState.isValidating,
  ] as const;
  for (const map of pathMaps) {
    if (map) {
      for (const path in map) {
        changedPaths.add(path);
      }
    }
  }

  if (partialState.persist) {
    changedPaths.add("persist");
  }

  if ("isValid" in partialState) {
    changedPaths.add("isValid");
  }

  if ("isDirty" in partialState) {
    changedPaths.add("isDirty");
  }

  if ("isSubmitting" in partialState) {
    changedPaths.add("isSubmitting");
  }

  return changedPaths.size > 0 ? Array.from(changedPaths) : undefined;
}

function mergeChangedPaths(
  explicitChangedPaths?: string[],
  inferredChangedPaths?: string[],
): string[] | undefined {
  if (!explicitChangedPaths?.length) {
    return inferredChangedPaths;
  }

  if (!inferredChangedPaths?.length) {
    return explicitChangedPaths;
  }

  const merged = new Set<string>();

  for (const path of explicitChangedPaths) {
    merged.add(path);
  }

  for (const path of inferredChangedPaths) {
    merged.add(path);
  }

  return Array.from(merged);
}
