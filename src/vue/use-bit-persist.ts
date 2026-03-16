import { computed, onUnmounted, ref } from "vue";
import { useBitStore } from "./context";
import type { UseBitPersistResult } from "./types";

export function useBitPersist<T extends object = any>(): UseBitPersistResult {
  const store = useBitStore<T>();
  const meta = ref(store.getPersistMetadata());

  const unsubscribe = store.subscribeSelector(
    (state) => state.persist,
    (nextMeta) => {
      meta.value = nextMeta;
    },
  );

  onUnmounted(() => unsubscribe());

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
      isSaving: computed(() => meta.value.isSaving),
      isRestoring: computed(() => meta.value.isRestoring),
      error: computed(() => meta.value.error),
    },
  };
}
