import { useCallback, useRef, useSyncExternalStore } from "react";
import { isHistoryMetaEqual, type HistoryMeta } from "../core/history-status";
import { useBitStore } from "./context";
import type { UseBitHistoryResult } from "./types";

export function useBitHistory<T extends object = any>(): UseBitHistoryResult {
  const store = useBitStore<T>();
  const lastMeta = useRef<HistoryMeta | null>(null);

  const getSnapshot = useCallback(() => {
    const nextMeta = store.getHistoryMetadata();

    if (lastMeta.current && isHistoryMetaEqual(lastMeta.current, nextMeta)) {
      return lastMeta.current;
    }

    const stableMeta = {
      canUndo: nextMeta.canUndo,
      canRedo: nextMeta.canRedo,
      historyIndex: nextMeta.historyIndex,
      historySize: nextMeta.historySize,
    };

    lastMeta.current = stableMeta;
    return stableMeta;
  }, [store]);

  const subscribe = useCallback(
    (cb: () => void) => store.subscribe(cb),
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
