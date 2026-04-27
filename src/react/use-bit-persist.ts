import { useCallback, useMemo, useSyncExternalStore, useRef } from "react";
import { readPersistMetaSnapshot, subscribePersistMetaSnapshot } from "../core";
import { useBitStore } from "./context";
import type { UseBitPersistResult } from "./types";

export function useBitPersist(): UseBitPersistResult {
  const store = useBitStore<any>();

  const subscribePersistMeta = useCallback(
    (cb: () => void) => subscribePersistMetaSnapshot(store, cb),
    [store],
  );

  const lastMeta = useRef<ReturnType<typeof readPersistMetaSnapshot> | null>(null);

  const getSnapshot = useCallback(() => {
    const nextMeta = readPersistMetaSnapshot(store);

    if (
      lastMeta.current &&
      lastMeta.current.isSaving === nextMeta.isSaving &&
      lastMeta.current.isRestoring === nextMeta.isRestoring &&
      lastMeta.current.error === nextMeta.error
    ) {
      return lastMeta.current;
    }

    lastMeta.current = nextMeta;
    return nextMeta;
  }, [store]);

  const persistMeta = useSyncExternalStore(
    subscribePersistMeta,
    getSnapshot,
    getSnapshot,
  );

  const restore = useCallback(async () => {
    return store.feature.restorePersisted();
  }, [store]);

  const save = useCallback(async () => {
    await store.feature.forceSave();
  }, [store]);

  const clear = useCallback(async () => {
    await store.feature.clearPersisted();
  }, [store]);

  const meta = useMemo(
    () => ({
      isSaving: persistMeta.isSaving,
      isRestoring: persistMeta.isRestoring,
      error: persistMeta.error,
    }),
    [persistMeta],
  );

  return useMemo(
    () => ({
      restore,
      save,
      clear,
      meta,
    }),
    [restore, save, clear, meta],
  );
}
