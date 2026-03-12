import { useCallback, useMemo, useState } from "react";
import { useBitStore } from "./context";
import type { UseBitPersistResult } from "./types";

export function useBitPersist(): UseBitPersistResult {
  const store = useBitStore<any>();
  const [isSaving, setIsSaving] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const restore = useCallback(async () => {
    setIsRestoring(true);
    setError(null);

    try {
      return await store.restorePersisted();
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      return false;
    } finally {
      setIsRestoring(false);
    }
  }, [store]);

  const save = useCallback(async () => {
    setIsSaving(true);
    setError(null);

    try {
      await store.forceSave();
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsSaving(false);
    }
  }, [store]);

  const clear = useCallback(async () => {
    setError(null);

    try {
      await store.clearPersisted();
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    }
  }, [store]);

  const meta = useMemo(
    () => ({
      isSaving,
      isRestoring,
      error,
    }),
    [isSaving, isRestoring, error],
  );

  return {
    restore,
    save,
    clear,
    meta,
  };
}
