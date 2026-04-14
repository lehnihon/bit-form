import { useCallback, useMemo, useSyncExternalStore } from "react";
import { readPersistMetaSnapshot, subscribePersistMetaSnapshot } from "../core";
import { useBitStore } from "./context";
import type { UseBitPersistResult } from "./types";

export function useBitPersist(): UseBitPersistResult {
  const store = useBitStore<any>();

  const subscribePersistMeta = useCallback(
    (cb: () => void) => subscribePersistMetaSnapshot(store, cb),
    [store],
  );

  const persistMeta = useSyncExternalStore(
    subscribePersistMeta,
    () => readPersistMetaSnapshot(store),
    () => readPersistMetaSnapshot(store),
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
