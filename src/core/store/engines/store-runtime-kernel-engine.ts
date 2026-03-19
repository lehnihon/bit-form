import type { BitState } from "../contracts/types";
import type { BitStoreOperation } from "./operation-engine";
import { executeStoreOperation } from "./store-dispatch-engine";
import {
  flushStoreBatchState,
  getEffectiveStoreState,
  trackBatchedStoreUpdate,
  type BitStoreBatchState,
} from "./store-batch-engine";

export function dispatchStoreKernelOperation<T extends object>(args: {
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

  const currentState = getEffectiveStoreState(state, batchState);

  if (batchState.depth > 0) {
    const updateResult = executeStoreOperation({
      currentState,
      operation,
      applyComputedValues: (values) => values,
    });

    if (!updateResult) {
      return state;
    }

    trackBatchedStoreUpdate(batchState, updateResult);
    return state;
  }

  const updateResult = executeStoreOperation({
    currentState: state,
    operation,
    applyComputedValues,
  });

  if (!updateResult) {
    return state;
  }

  onStateCommitted({
    nextState: updateResult.nextState,
    changedPaths: updateResult.changedPaths,
    valuesChanged: updateResult.valuesChanged,
  });

  return updateResult.nextState;
}

export function flushStoreKernelBatch<T extends object>(args: {
  state: BitState<T>;
  batchState: BitStoreBatchState<T>;
  applyComputedValues: (values: T, changedPaths?: readonly string[]) => T;
  onStateCommitted: (payload: {
    nextState: BitState<T>;
    changedPaths?: Iterable<string>;
    valuesChanged: boolean;
  }) => void;
}): BitState<T> {
  const { state, batchState, applyComputedValues, onStateCommitted } = args;

  const flushResult = flushStoreBatchState({
    currentState: state,
    batchState,
    applyComputedValues,
  });

  if (!flushResult) {
    return state;
  }

  onStateCommitted({
    nextState: flushResult.nextState,
    changedPaths: flushResult.changedPaths,
    valuesChanged: flushResult.valuesChanged,
  });

  return flushResult.nextState;
}
