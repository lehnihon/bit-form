import { useCallback, useRef, useSyncExternalStore } from "react";
import {
  BitFrameworkStoreApi,
  BitStoreApi,
  readHistoryMetaSnapshot,
  type HistoryMeta,
} from "../core";
import { resolveReactStore } from "./store";
import type { UseBitHistoryResult } from "./types";

export function useBitHistory<T extends object = any>(
  storeInput: BitFrameworkStoreApi<T> | BitStoreApi<T>,
): UseBitHistoryResult {
  const store = resolveReactStore(storeInput);
  const lastMeta = useRef<HistoryMeta | null>(null);

  const getSnapshot = useCallback(() => {
    const nextMeta = readHistoryMetaSnapshot(store);

    if (
      lastMeta.current &&
      lastMeta.current.canUndo === nextMeta.canUndo &&
      lastMeta.current.canRedo === nextMeta.canRedo &&
      lastMeta.current.historyIndex === nextMeta.historyIndex &&
      lastMeta.current.historySize === nextMeta.historySize
    ) {
      return lastMeta.current;
    }

    lastMeta.current = nextMeta;
    return nextMeta;
  }, [store]);

  const subscribe = useCallback(
    (cb: () => void) => store.observe.subscribeHistoryMeta(() => cb()),
    [store],
  );

  const meta = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const undo = useCallback(() => {
    store.feature.undo();
  }, [store]);

  const redo = useCallback(() => {
    store.feature.redo();
  }, [store]);

  return {
    ...meta,
    undo,
    redo,
  };
}
