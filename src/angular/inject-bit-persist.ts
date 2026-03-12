import { signal } from "@angular/core";
import { useBitStore } from "./provider";
import type { InjectBitPersistResult } from "./types";

export function injectBitPersist<
  T extends object = any,
>(): InjectBitPersistResult {
  const store = useBitStore<T>();
  const isSaving = signal(false);
  const isRestoring = signal(false);
  const error = signal<Error | null>(null);

  const restore = async (): Promise<boolean> => {
    isRestoring.set(true);
    error.set(null);

    try {
      return await store.restorePersisted();
    } catch (err) {
      error.set(err instanceof Error ? err : new Error(String(err)));
      return false;
    } finally {
      isRestoring.set(false);
    }
  };

  const save = async (): Promise<void> => {
    isSaving.set(true);
    error.set(null);

    try {
      await store.forceSave();
    } catch (err) {
      error.set(err instanceof Error ? err : new Error(String(err)));
    } finally {
      isSaving.set(false);
    }
  };

  const clear = async (): Promise<void> => {
    error.set(null);

    try {
      await store.clearPersisted();
    } catch (err) {
      error.set(err instanceof Error ? err : new Error(String(err)));
    }
  };

  return {
    restore,
    save,
    clear,
    meta: {
      isSaving: isSaving.asReadonly(),
      isRestoring: isRestoring.asReadonly(),
      error: error.asReadonly(),
    },
  };
}
