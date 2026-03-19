import type { BitState } from "../contracts/types";
import { applyStateUpdate } from "./state-update-engine";
import type { BitStatePatchOperation } from "./operation-engine";

export function executeStatePatchOperation<T extends object>(args: {
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
