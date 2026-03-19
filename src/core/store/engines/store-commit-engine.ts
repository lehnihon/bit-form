import type { BitState } from "../contracts/types";
import {
  BitStatePatchOperation,
  BitStoreOperation,
  patchStateOperation,
} from "./operation-engine";
import { applyStateUpdate } from "./state-update-engine";
import {
  flushStoreBatchState,
  getEffectiveStoreState,
  trackBatchedStoreUpdate,
  type BitStoreBatchState,
} from "./store-batch-engine";

function routeStoreOperation<T extends object>(
  currentState: Readonly<BitState<T>>,
  operation: BitStoreOperation<T>,
): BitStatePatchOperation<T> | null {
  if (operation.kind === "state.patch") {
    return operation;
  }

  if (operation.kind === "field.touchMany") {
    if (operation.paths.length === 0) {
      return null;
    }

    const touched = { ...currentState.touched };
    for (const path of operation.paths) {
      touched[path as keyof typeof touched] = true;
    }

    return patchStateOperation({ touched }, operation.paths);
  }

  if (operation.kind === "form.persistMeta") {
    return patchStateOperation({
      persist: {
        ...currentState.persist,
        ...operation.patch,
      },
    });
  }

  if (operation.kind === "history.apply") {
    return patchStateOperation(
      {
        values: operation.values,
        isDirty: operation.isDirty,
      },
      ["*"],
      { requireExplicitChangedPaths: true },
    );
  }

  return patchStateOperation({
    errors: operation.errors,
    isValid: operation.isValid,
  });
}

function executeStatePatchOperation<T extends object>(args: {
  currentState: BitState<T>;
  operation: BitStatePatchOperation<T>;
  applyComputedValues: (values: T, changedPaths?: string[]) => T;
}) {
  const { currentState, operation, applyComputedValues } = args;

  const hasValuesPatch = Object.prototype.hasOwnProperty.call(
    operation.partialState,
    "values",
  );
  const effectiveChangedPaths =
    operation.changedPaths ?? (hasValuesPatch ? ["*"] : undefined);
  const inferValueChangedPaths =
    operation.requireExplicitChangedPaths === undefined
      ? false
      : !operation.requireExplicitChangedPaths;

  return applyStateUpdate({
    currentState,
    partialState: operation.partialState,
    changedPaths: effectiveChangedPaths,
    applyComputedValues: (values) =>
      applyComputedValues(values, effectiveChangedPaths),
    inferValueChangedPaths,
  });
}

function executeStoreOperation<T extends object>(args: {
  currentState: BitState<T>;
  operation: BitStoreOperation<T>;
  applyComputedValues: (values: T, changedPaths?: string[]) => T;
}) {
  const { currentState, operation, applyComputedValues } = args;
  const patchOperation = routeStoreOperation(currentState, operation);

  if (!patchOperation) {
    return null;
  }

  return executeStatePatchOperation({
    currentState,
    operation: patchOperation,
    applyComputedValues: (values, changedPaths) =>
      patchOperation.skipComputed
        ? values
        : applyComputedValues(values, changedPaths),
  });
}

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
