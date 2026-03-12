import { ref, readonly } from "vue";
import { useBitStore } from "./context";
import type { UseBitPersistResult } from "./types";

export function useBitPersist<T extends object = any>(): UseBitPersistResult {
  const store = useBitStore<T>();
  const isSaving = ref(false);
  const isRestoring = ref(false);
  const error = ref<Error | null>(null);

  const restore = async (): Promise<boolean> => {
    isRestoring.value = true;
    error.value = null;

    try {
      return await store.restorePersisted();
    } catch (err) {
      error.value = err instanceof Error ? err : new Error(String(err));
      return false;
    } finally {
      isRestoring.value = false;
    }
  };

  const save = async (): Promise<void> => {
    isSaving.value = true;
    error.value = null;

    try {
      await store.forceSave();
    } catch (err) {
      error.value = err instanceof Error ? err : new Error(String(err));
    } finally {
      isSaving.value = false;
    }
  };

  const clear = async (): Promise<void> => {
    error.value = null;

    try {
      await store.clearPersisted();
    } catch (err) {
      error.value = err instanceof Error ? err : new Error(String(err));
    }
  };

  return {
    restore,
    save,
    clear,
    meta: {
      isSaving: readonly(isSaving),
      isRestoring: readonly(isRestoring),
      error: readonly(error),
    },
  };
}
