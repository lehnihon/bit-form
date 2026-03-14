import type { BitState } from "./types";

export interface BitStateUpdateResult<T extends object> {
  nextState: BitState<T>;
  changedPaths?: string[];
  valuesChanged: boolean;
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
    nextState.isValid = Object.keys(nextState.errors).length === 0;
  }

  const effectiveChangedPaths =
    changedPaths && changedPaths.length > 0
      ? changedPaths
      : partialState.values
        ? ["*"]
        : undefined;

  return {
    nextState,
    changedPaths: effectiveChangedPaths,
    valuesChanged,
  };
}
