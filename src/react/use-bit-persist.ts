import { useCallback, useMemo, useSyncExternalStore } from "react";
import { useBitStore } from "./context";
import { readPersistMetaSnapshot, subscribePersistMetaSnapshot } from "../core";
import type { UseBitPersistResult } from "./types";

export function useBitPersist(): UseBitPersistResult {
  const store = useBitStore<any>();

  const persistMeta = useSyncExternalStore(
    (cb) => subscribePersistMetaSnapshot(store, cb),
    () => readPersistMetaSnapshot(store),
    () => readPersistMetaSnapshot(store),
  );

  const restore = useCallback(async () => {
    return store.restorePersisted();
  }, [store]);

  const save = useCallback(async () => {
    await store.forceSave();
  }, [store]);

  const clear = useCallback(async () => {
    await store.clearPersisted();
  }, [store]);

  const meta = useMemo(
    () => ({
      isSaving: persistMeta.isSaving,
      isRestoring: persistMeta.isRestoring,
      error: persistMeta.error,
    }),
    [persistMeta],
  );

  return {
    restore,
    save,
    clear,
    meta,
  };
}
