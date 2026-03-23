import type { BitState } from "../core";
import type { DevToolsStoreSnapshot, DevToolsStoreSnapshots } from "./protocol";
import { isDevToolsReadableStore } from "./store-port";

function normalizeStoreState<T extends object>(
  state: Readonly<BitState<T>>,
): Omit<DevToolsStoreSnapshot, "_meta"> {
  return {
    values: state.values,
    errors: state.errors as Record<string, unknown>,
    touched: state.touched as Record<string, unknown>,
    isValid: state.isValid,
    isDirty: state.isDirty,
    isSubmitting: state.isSubmitting,
    isValidating: state.isValidating as Record<string, unknown>,
    persist: state.persist,
  };
}

export function createDevToolsStoreSnapshot<T extends object>(store: {
  getState: () => Readonly<BitState<T>>;
  getHistoryMetadata: () => {
    canUndo: boolean;
    canRedo: boolean;
    historySize: number;
    historyIndex: number;
  };
}): DevToolsStoreSnapshot {
  const historyMeta = store.getHistoryMetadata();

  return {
    ...normalizeStoreState(store.getState()),
    _meta: {
      canUndo: historyMeta.canUndo,
      canRedo: historyMeta.canRedo,
      totalSteps: historyMeta.historySize,
      currentIndex: historyMeta.historyIndex,
    },
  };
}

export function createDevToolsSnapshotMap(
  stores: Record<string, unknown>,
): DevToolsStoreSnapshots {
  const snapshots: DevToolsStoreSnapshots = {};

  for (const [storeId, instance] of Object.entries(stores)) {
    if (!isDevToolsReadableStore(instance)) {
      continue;
    }

    snapshots[storeId] = createDevToolsStoreSnapshot(instance);
  }

  return snapshots;
}
