import { computed, onUnmounted, shallowRef } from "vue";
import { useBitStore } from "./context";
import type { UseBitHistoryResult } from "./types";

export function useBitHistory<T extends object = any>(): UseBitHistoryResult {
  const store = useBitStore<T>();

  const meta = shallowRef(store.getHistoryMetadata());

  const unsubscribe = store.subscribe(() => {
    meta.value = store.getHistoryMetadata();
  });

  onUnmounted(unsubscribe);

  const undo = () => store.undo();
  const redo = () => store.redo();

  return {
    canUndo: computed(() => meta.value.canUndo),
    canRedo: computed(() => meta.value.canRedo),
    historyIndex: computed(() => meta.value.historyIndex),
    historySize: computed(() => meta.value.historySize),
    undo,
    redo,
  };
}
