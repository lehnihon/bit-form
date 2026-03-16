import { useCallback, useMemo, useSyncExternalStore } from "react";
import { useBitStore } from "./context";
import type { UseBitPersistResult } from "./types";

export function useBitPersist(): UseBitPersistResult {
  const store = useBitStore<any>();

  const persistMeta = useSyncExternalStore(
    (cb) =>
      store.subscribeSelector(
        (state) => state.persist,
        () => cb(),
      ),
    () => store.getPersistMetadata(),
    () => store.getPersistMetadata(),
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
