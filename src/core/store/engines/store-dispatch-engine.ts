import type { BitState } from "../contracts/types";
import type { BitStoreOperation } from "./operation-engine";
import { executeStatePatchOperation } from "./store-kernel-engine";
import { routeStoreOperation } from "./store-operation-router";

export function executeStoreOperation<T extends object>(args: {
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
