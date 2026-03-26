import {
  beginStoreBatch,
  endStoreBatch,
  type BitStoreBatchState,
} from "../engines/store-batch-engine";
import {
  dispatchStoreKernelOperation,
  flushStoreKernelBatch,
} from "../engines/store-commit-engine";
import type { BitStoreOperation } from "../engines/operation-engine";
import type { BitState } from "../contracts/types";

export function runStoreStateBatch<T extends object, TResult>(args: {
  batchState: BitStoreBatchState<T>;
  callback: () => TResult;
  flushBatchedStateUpdates: () => void;
}): TResult {
  const { batchState, callback, flushBatchedStateUpdates } = args;
  beginStoreBatch(batchState);

  try {
    return callback();
  } finally {
    if (endStoreBatch(batchState)) {
      flushBatchedStateUpdates();
    }
  }
}

export function commitStoreStateUpdate<T extends object>(args: {
  payload: {
    nextState: BitState<T>;
    changedPaths?: Iterable<string>;
    valuesChanged: boolean;
  };
  setState: (state: BitState<T>) => void;
  notifySubscriptions: (
    state: BitState<T>,
    changedPaths?: Iterable<string>,
  ) => void;
  notifyEffects: (state: BitState<T>, valuesChanged: boolean) => void;
}): void {
  const { payload, setState, notifySubscriptions, notifyEffects } = args;
  setState(payload.nextState);
  notifySubscriptions(payload.nextState, payload.changedPaths);
  notifyEffects(payload.nextState, payload.valuesChanged);
}

export function dispatchStoreStateOperation<T extends object>(args: {
  state: BitState<T>;
  batchState: BitStoreBatchState<T>;
  operation: BitStoreOperation<T>;
  applyComputedValues: (values: T, changedPaths?: readonly string[]) => T;
  onStateCommitted: (payload: {
    nextState: BitState<T>;
    changedPaths?: Iterable<string>;
    valuesChanged: boolean;
  }) => void;
}): BitState<T> {
  const {
    state,
    batchState,
    operation,
    applyComputedValues,
    onStateCommitted,
  } = args;

  return dispatchStoreKernelOperation({
    state,
    batchState,
    operation,
    applyComputedValues,
    onStateCommitted,
  });
}

export function saveStoreHistorySnapshot<T extends object>(args: {
  batchState: BitStoreBatchState<T>;
  values: T;
  saveHistory: (values: T) => void;
}): void {
  const { batchState, values, saveHistory } = args;

  if (batchState.depth > 0) {
    batchState.pendingHistorySnapshot = true;
    return;
  }

  saveHistory(values);
}

export function flushStoreBatchedStateUpdates<T extends object>(args: {
  state: BitState<T>;
  batchState: BitStoreBatchState<T>;
  applyComputedValues: (values: T, changedPaths?: readonly string[]) => T;
  applyPostBatchValues?: (values: T, changedPaths?: readonly string[]) => T;
  onStateCommitted: (payload: {
    nextState: BitState<T>;
    changedPaths?: Iterable<string>;
    valuesChanged: boolean;
  }) => void;
  saveHistory: (values: T) => void;
}): BitState<T> {
  const {
    state,
    batchState,
    applyComputedValues,
    applyPostBatchValues,
    onStateCommitted,
    saveHistory,
  } = args;

  const nextState = flushStoreKernelBatch({
    state,
    batchState,
    applyComputedValues,
    applyPostBatchValues,
    onStateCommitted,
  });

  if (batchState.pendingHistorySnapshot) {
    batchState.pendingHistorySnapshot = false;
    saveHistory(nextState.values);
  }

  return nextState;
}
