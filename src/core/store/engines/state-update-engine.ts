import { mergePaths } from "../../utils/path-utils";
import type { BitErrors, BitState } from "../contracts/types";
import { hasAnyError } from "../shared/error-map";

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
    const typedMessage = message as string | undefined;

    if (typedMessage === undefined) {
      return;
    }

    normalized[path as keyof BitErrors<T>] = typedMessage;
  });

  return normalized;
}

export interface BitStateUpdateResult<T extends object> {
  nextState: BitState<T>;
  changedPaths?: string[];
  valuesChanged: boolean;
}

export function applyStateUpdate<T extends object>(args: {
  currentState: BitState<T>;
  partialState: Partial<BitState<T>>;
  changedPaths?: string[];
  applyValueDerivations?: (values: T, changedPaths?: readonly string[]) => T;
  applyComputedValues?: (values: T) => T;
}): BitStateUpdateResult<T> {
  const {
    currentState,
    partialState,
    changedPaths,
    applyValueDerivations,
    applyComputedValues,
  } = args;
  const deriveValues =
    applyValueDerivations ??
    ((values: T) =>
      applyComputedValues ? applyComputedValues(values) : values);

  const nextState: BitState<T> = { ...currentState, ...partialState };
  const valuesChanged = !!partialState.values;

  if (partialState.values) {
    nextState.values = deriveValues(partialState.values, changedPaths);
  }

  if (partialState.errors) {
    nextState.errors = normalizeErrors(partialState.errors as BitErrors<T>);
    nextState.isValid = !hasAnyError(
      nextState.errors as Record<string, unknown>,
    );
  }

  const explicitChangedPaths =
    changedPaths && changedPaths.length > 0 ? changedPaths : undefined;
  const inferredChangedPaths = inferChangedPaths(partialState);
  const effectiveChangedPaths = mergePaths(
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
