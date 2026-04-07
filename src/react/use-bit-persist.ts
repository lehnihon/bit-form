import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  BitFrameworkStoreApi,
  BitStoreApi,
  readPersistMetaSnapshot,
  subscribePersistMetaSnapshot,
} from "../core";
import { resolveReactStore } from "./store";
import type { UseBitPersistResult } from "./types";

export function useBitPersist<T extends object = any>(
  storeInput: BitFrameworkStoreApi<T> | BitStoreApi<T>,
): UseBitPersistResult {
  const store = resolveReactStore(storeInput);

  const persistMeta = useSyncExternalStore(
    (cb) => subscribePersistMetaSnapshot(store, cb),
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

  return {
    restore,
    save,
    clear,
    meta,
  };
}
