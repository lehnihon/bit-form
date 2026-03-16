import { computed, inject, signal, DestroyRef } from "@angular/core";
import { useBitStore } from "./provider";
import type { InjectBitPersistResult } from "./types";

export function injectBitPersist<
  T extends object = any,
>(): InjectBitPersistResult {
  const store = useBitStore<T>();
  const persist = signal(store.getPersistMetadata());

  const unsubscribe = store.subscribeSelector(
    (state) => state.persist,
    (nextPersist) => {
      persist.set(nextPersist);
    },
  );

  try {
    inject(DestroyRef).onDestroy(() => unsubscribe());
  } catch {}

  const restore = async (): Promise<boolean> => {
    return store.restorePersisted();
  };

  const save = async (): Promise<void> => {
    await store.forceSave();
  };

  const clear = async (): Promise<void> => {
    await store.clearPersisted();
  };

  return {
    restore,
    save,
    clear,
    meta: {
      isSaving: computed(() => persist().isSaving),
      isRestoring: computed(() => persist().isRestoring),
      error: computed(() => persist().error),
    },
  };
}
