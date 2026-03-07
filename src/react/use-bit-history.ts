import { useCallback, useRef, useSyncExternalStore } from "react";
import { useBitStore } from "./context";

export interface UseBitHistoryResult {
  canUndo: boolean;
  canRedo: boolean;
  historyIndex: number;
  historySize: number;
  undo: () => void;
  redo: () => void;
}

export function useBitHistory<T extends object = any>(): UseBitHistoryResult {
  const store = useBitStore<T>();
  const lastMeta = useRef<{
    canUndo: boolean;
    canRedo: boolean;
    historyIndex: number;
    historySize: number;
  } | null>(null);

  const getSnapshot = useCallback(() => {
    const nextMeta = store.getHistoryMetadata();

    if (
      lastMeta.current &&
      lastMeta.current.canUndo === nextMeta.canUndo &&
      lastMeta.current.canRedo === nextMeta.canRedo &&
      lastMeta.current.historyIndex === nextMeta.historyIndex &&
      lastMeta.current.historySize === nextMeta.historySize
    ) {
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

  const meta = useSyncExternalStore(
    store.subscribe.bind(store),
    getSnapshot,
    getSnapshot,
  );

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
