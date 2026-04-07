import { computed, DestroyRef, inject, signal } from "@angular/core";
import {
  BitFrameworkStoreApi,
  BitStoreApi,
  observePersistMetaSnapshot,
} from "../core";
import { resolveAngularStore } from "./store";
import type { InjectBitPersistResult } from "./types";

export function injectBitPersist<T extends object = any>(
  storeInput: BitFrameworkStoreApi<T> | BitStoreApi<T>,
): InjectBitPersistResult {
  const store = resolveAngularStore(storeInput);
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
