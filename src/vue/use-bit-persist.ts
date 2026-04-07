import { computed, onUnmounted, ref } from "vue";
import {
  BitFrameworkStoreApi,
  BitStoreApi,
  observePersistMetaSnapshot,
} from "../core";
import { resolveVueStore } from "./store";
import type { UseBitPersistResult } from "./types";

export function useBitPersist<T extends object = any>(
  storeInput: BitFrameworkStoreApi<T> | BitStoreApi<T>,
): UseBitPersistResult {
  const store = resolveVueStore(storeInput);
  const meta = ref(store.read.getPersistMetadata());

  const unsubscribe = observePersistMetaSnapshot(store, (nextMeta) => {
    meta.value = nextMeta;
  });

  onUnmounted(() => unsubscribe());

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
      isSaving: computed(() => meta.value.isSaving),
      isRestoring: computed(() => meta.value.isRestoring),
      error: computed(() => meta.value.error),
    },
  };
}
