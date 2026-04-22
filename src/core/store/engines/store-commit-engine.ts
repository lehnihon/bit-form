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
  onOperationError?: (error: unknown) => void;
}) {
  const { currentState, operation, applyValueDerivations, onOperationError } =
    args;

  const hasValuesPatch = Object.prototype.hasOwnProperty.call(
    operation.partialState,
    "values",
  );
  const effectiveChangedPaths =
    operation.changedPaths ?? (hasValuesPatch ? ["*"] : undefined);

  let result;
  try {
    result = applyStateUpdate({
      currentState,
      partialState: operation.partialState,
      changedPaths: effectiveChangedPaths,
      applyValueDerivations,
    });
  } catch (error) {
    try {
      onOperationError?.(error);
    } catch (observabilityError) {
      // Impede que erros de observabilidade abortem o commit do state update com valores em raw
    }
    result = applyStateUpdate({
      currentState,
      partialState: operation.partialState,
      changedPaths: effectiveChangedPaths,
      applyValueDerivations: (values) => values, // No derivation fallback
    });
  }
  return result;
}

function executeStoreOperation<T extends object>(args: {
  currentState: BitState<T>;
  operation: BitStoreOperation<T>;
  applyValueDerivations: (values: T, changedPaths?: readonly string[]) => T;
  onOperationError?: (error: unknown) => void;
}) {
  const { currentState, operation, applyValueDerivations, onOperationError } =
    args;
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
    onOperationError,
  });
}

export function dispatchStoreKernelOperation<T extends object>(args: {
  state: BitState<T>;
  batchState: BitStoreBatchState<T>;
  operation: BitStoreOperation<T>;
  applyValueDerivations: (values: T, changedPaths?: readonly string[]) => T;
  onOperationError?: (error: unknown) => void;
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
    onOperationError,
    onStateCommitted,
  } = args;

  const currentState = getEffectiveStoreState(state, batchState);

  if (batchState.depth > 0) {
    const updateResult = executeStoreOperation({
      currentState,
      operation,
      applyValueDerivations: (values) => values,
      onOperationError,
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
    onOperationError,
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
  onDerivationError?: (error: unknown) => void;
  onStateCommitted: (payload: {
    nextState: BitState<T>;
    changedPaths?: Iterable<string>;
    valuesChanged: boolean;
  }) => void;
}): BitState<T> {
  const {
    state,
    batchState,
    applyValueDerivations,
    onDerivationError,
    onStateCommitted,
  } = args;

  const flushResult = flushStoreBatchState({
    currentState: state,
    batchState,
    applyValueDerivations,
    onDerivationError,
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
