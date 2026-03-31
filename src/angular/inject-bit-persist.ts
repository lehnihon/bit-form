import { computed, DestroyRef, inject, signal } from "@angular/core";
import { useBitStore } from "./provider";
import { observePersistMetaSnapshot } from "../core";
import type { InjectBitPersistResult } from "./types";

export function injectBitPersist<
  T extends object = any,
>(): InjectBitPersistResult {
  const store = useBitStore<T>();
  const persist = signal(store.read.getPersistMetadata());

  const unsubscribe = observePersistMetaSnapshot(store, (nextPersist) => {
    persist.set(nextPersist);
  });

  const destroyRef = inject(DestroyRef, { optional: true });
  destroyRef?.onDestroy(() => unsubscribe());

  const restore = async (): Promise<boolean> => {
    return store.feature.restorePersisted();
  };

  const save = async (): Promise<void> => {
    await store.feature.forceSave();
  };

  const clear = async (): Promise<void> => {
    await store.feature.clearPersisted();
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
