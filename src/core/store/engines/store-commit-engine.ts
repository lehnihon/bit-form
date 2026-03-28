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

function assertNever(value: never): never {
  throw new Error(
    `BitStore: unsupported operation kind: ${String((value as { kind?: unknown }).kind)}`,
  );
}

function routeStoreOperation<T extends object>(
  currentState: Readonly<BitState<T>>,
  operation: BitStoreOperation<T>,
): BitStatePatchOperation<T> | null {
  switch (operation.kind) {
    case "state.patch":
      return operation;

    case "field.touchMany": {
      if (operation.paths.length === 0) {
        return null;
      }

      const touched = { ...currentState.touched };
      for (const path of operation.paths) {
        touched[path as keyof typeof touched] = true;
      }

      return patchStateOperation({ touched }, operation.paths);
    }

    case "form.persistMeta":
      return patchStateOperation({
        persist: {
          ...currentState.persist,
          ...operation.patch,
        },
      });

    case "history.apply":
      return patchStateOperation(
        {
          values: operation.values,
          isDirty: operation.isDirty,
        },
        ["*"],
      );

    case "validation.commit":
      return patchStateOperation({
        errors: operation.errors,
        isValid: operation.isValid,
      });

    default:
      return assertNever(operation);
  }
}

function executeStatePatchOperation<T extends object>(args: {
  currentState: BitState<T>;
  operation: BitStatePatchOperation<T>;
  applyValueDerivations: (values: T, changedPaths?: readonly string[]) => T;
}) {
  const { currentState, operation, applyValueDerivations } = args;

  const hasValuesPatch = Object.prototype.hasOwnProperty.call(
    operation.partialState,
    "values",
  );
  const effectiveChangedPaths =
    operation.changedPaths ?? (hasValuesPatch ? ["*"] : undefined);

  return applyStateUpdate({
    currentState,
    partialState: operation.partialState,
    changedPaths: effectiveChangedPaths,
    applyValueDerivations,
  });
}

function executeStoreOperation<T extends object>(args: {
  currentState: BitState<T>;
  operation: BitStoreOperation<T>;
  applyValueDerivations: (values: T, changedPaths?: readonly string[]) => T;
}) {
  const { currentState, operation, applyValueDerivations } = args;
  const patchOperation = routeStoreOperation(currentState, operation);

  if (!patchOperation) {
    return null;
  }

  return executeStatePatchOperation({
    currentState,
    operation: patchOperation,
    applyValueDerivations: (values, changedPaths) =>
      patchOperation.skipComputed
        ? values
        : applyValueDerivations(values, changedPaths),
  });
}

export function dispatchStoreKernelOperation<T extends object>(args: {
  state: BitState<T>;
  batchState: BitStoreBatchState<T>;
  operation: BitStoreOperation<T>;
  applyValueDerivations: (values: T, changedPaths?: readonly string[]) => T;
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
    applyValueDerivations,
    onStateCommitted,
  } = args;

  const currentState = getEffectiveStoreState(state, batchState);

  if (batchState.depth > 0) {
    const updateResult = executeStoreOperation({
      currentState,
      operation,
      applyValueDerivations: (values) => values,
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
    applyValueDerivations,
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
  applyValueDerivations: (values: T, changedPaths?: readonly string[]) => T;
  onStateCommitted: (payload: {
    nextState: BitState<T>;
    changedPaths?: Iterable<string>;
    valuesChanged: boolean;
  }) => void;
}): BitState<T> {
  const { state, batchState, applyValueDerivations, onStateCommitted } = args;

  const flushResult = flushStoreBatchState({
    currentState: state,
    batchState,
    applyValueDerivations,
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
