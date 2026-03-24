import { useCallback, useRef, useSyncExternalStore } from "react";
import { readHistoryMetaSnapshot, type HistoryMeta } from "../core";
import { useBitStore } from "./context";
import type { UseBitHistoryResult } from "./types";

export function useBitHistory<T extends object = any>(): UseBitHistoryResult {
  const store = useBitStore<T>();
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
    (cb: () => void) => store.subscribeHistoryMeta(() => cb()),
    [store],
  );

  const meta = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const undo = useCallback(() => {
    store.undo();
  }, [store]);

  const redo = useCallback(() => {
    store.redo();
  }, [store]);

  return {
    ...meta,
    undo,
    redo,
  };
}
