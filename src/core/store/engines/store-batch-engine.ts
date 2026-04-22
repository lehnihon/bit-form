import type { BitState } from "../contracts/types";
import type { BitStateUpdateResult } from "./state-update-engine";

export interface BitStoreBatchState<T extends object> {
  depth: number;
  pendingState: BitState<T> | null;
  changedPathSet: Set<string> | null;
  changedPathList: string[] | null;
  valuesChanged: boolean;
  /** When true, a history snapshot should be recorded the moment the top-level
   * batch flushes. This allows multiple mutations inside a `transaction()` –
   * including individual array operations – to produce a single history entry
   * instead of one per mutation. */
  pendingHistorySnapshot: boolean;
}

export interface BitStoreBatchFlushResult<T extends object> {
  nextState: BitState<T>;
  changedPaths?: readonly string[];
  valuesChanged: boolean;
}

export function createStoreBatchState<
  T extends object,
>(): BitStoreBatchState<T> {
  return {
    depth: 0,
    pendingState: null,
    changedPathSet: null,
    changedPathList: null,
    valuesChanged: false,
    pendingHistorySnapshot: false,
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
  if (updateResult.valuesChanged) {
    batchState.pendingHistorySnapshot = true;
  }

  if (updateResult.changedPaths && updateResult.changedPaths.length > 0) {
    const pathSet = batchState.changedPathSet ?? new Set<string>();
    const pathList = batchState.changedPathList ?? [];

    updateResult.changedPaths.forEach((path) => {
      if (pathSet.has("*") || pathSet.has(path)) {
        return;
      }

      if (path === "*") {
        pathSet.clear();
        pathList.length = 0;
        pathSet.add("*");
        pathList.push("*");
        return;
      }

      const hasAncestor = pathList.some(
        (existingPath) =>
          existingPath !== "*" && path.startsWith(`${existingPath}.`),
      );

      if (hasAncestor) {
        return;
      }

      for (let index = pathList.length - 1; index >= 0; index -= 1) {
        const existingPath = pathList[index];
        if (existingPath === "*" || !existingPath.startsWith(`${path}.`)) {
          continue;
        }

        pathSet.delete(existingPath);
        pathList.splice(index, 1);
      }

      pathSet.add(path);
      pathList.push(path);
    });

    batchState.changedPathSet = pathSet;
    batchState.changedPathList = pathList;
  }
}

export function flushStoreBatchState<T extends object>(args: {
  currentState: BitState<T>;
  batchState: BitStoreBatchState<T>;
  applyValueDerivations: (values: T, changedPaths?: readonly string[]) => T;
  onDerivationError?: (error: unknown) => void;
}): BitStoreBatchFlushResult<T> | null {
  const { currentState, batchState, applyValueDerivations, onDerivationError } =
    args;

  if (!batchState.pendingState) {
    return null;
  }

  let nextState = batchState.pendingState;
  const changedPaths = batchState.changedPathList ?? undefined;
  const valuesChanged = batchState.valuesChanged;

  try {
    if (valuesChanged) {
      try {
        nextState = {
          ...nextState,
          values: applyValueDerivations(nextState.values, changedPaths),
        };
      } catch (error) {
        // Derivation failed: commit the raw accumulated state without derived
        // values so that kernel.state and subscribers stay in sync.
        // The error is surfaced via onDerivationError for observability.
        try {
          onDerivationError?.(error);
        } catch (observabilityError) {
          // Prevent observability exceptions from poisoning the entire batch
          // and dropping the state updates.
        }
        // The raw state still advances into the store, so the history snapshot
        // MUST be recorded. Clearing the flag here would cause undo() to skip
        // this user mutation entirely, permanently desynchronising the history
        // stack from the live store state — a silent data-loss bug.
      }
    }
  } finally {
    batchState.pendingState = null;
    batchState.changedPathSet = null;
    batchState.changedPathList = null;
    batchState.valuesChanged = false;
  }

  // Note: pendingHistorySnapshot is reset by the caller after it records the snapshot.

  return {
    nextState: nextState ?? currentState,
    changedPaths,
    valuesChanged,
  };
}
