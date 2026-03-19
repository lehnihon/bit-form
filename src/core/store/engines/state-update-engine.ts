import type { BitErrors, BitState } from "../contracts/types";

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
}): BitStateUpdateResult<T> {
  const { currentState, partialState, changedPaths, applyComputedValues } =
    args;

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
  const inferredChangedPaths = inferChangedPaths(partialState);
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
  partialState: Partial<BitState<T>>,
): string[] | undefined {
  const changedPaths = new Set<string>();

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
