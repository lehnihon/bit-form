import type { BitState } from "../contracts/types";
import type { BitStateUpdateResult } from "./state-update-engine";

export interface BitStoreBatchState<T extends object> {
  depth: number;
  pendingState: BitState<T> | null;
  changedPathSet: Set<string> | null;
  valuesChanged: boolean;
}

export interface BitStoreBatchFlushResult<T extends object> {
  nextState: BitState<T>;
  changedPaths?: Set<string>;
  valuesChanged: boolean;
}

export function createStoreBatchState<
  T extends object,
>(): BitStoreBatchState<T> {
  return {
    depth: 0,
    pendingState: null,
    changedPathSet: null,
    valuesChanged: false,
  };
}

export function beginStoreBatch<T extends object>(
  batchState: BitStoreBatchState<T>,
): void {
  batchState.depth += 1;
}

export function endStoreBatch<T extends object>(
  batchState: BitStoreBatchState<T>,
): boolean {
  batchState.depth -= 1;
  return batchState.depth === 0;
}

export function getEffectiveStoreState<T extends object>(
  currentState: BitState<T>,
  batchState: BitStoreBatchState<T>,
): BitState<T> {
  return batchState.pendingState ?? currentState;
}

export function trackBatchedStoreUpdate<T extends object>(
  batchState: BitStoreBatchState<T>,
  updateResult: BitStateUpdateResult<T>,
): void {
  batchState.pendingState = updateResult.nextState;
  batchState.valuesChanged ||= updateResult.valuesChanged;

  if (updateResult.changedPaths && updateResult.changedPaths.length > 0) {
    const pathSet = batchState.changedPathSet ?? new Set<string>();
    updateResult.changedPaths.forEach((path) => pathSet.add(path));
    batchState.changedPathSet = pathSet;
  }
}

export function flushStoreBatchState<T extends object>(args: {
  currentState: BitState<T>;
  batchState: BitStoreBatchState<T>;
  applyComputedValues: (values: T, changedPaths?: readonly string[]) => T;
}): BitStoreBatchFlushResult<T> | null {
  const { currentState, batchState, applyComputedValues } = args;

  if (!batchState.pendingState) {
    return null;
  }

  let nextState = batchState.pendingState;
  const changedPaths = batchState.changedPathSet ?? undefined;
  const valuesChanged = batchState.valuesChanged;

  if (valuesChanged) {
    const computedChangedPaths = changedPaths ? [...changedPaths] : undefined;
    nextState = {
      ...nextState,
      values: applyComputedValues(nextState.values, computedChangedPaths),
    };
  }

  batchState.pendingState = null;
  batchState.changedPathSet = null;
  batchState.valuesChanged = false;

  return {
    nextState: nextState ?? currentState,
    changedPaths,
    valuesChanged,
  };
}
