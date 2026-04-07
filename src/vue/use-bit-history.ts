import { computed, onUnmounted, shallowRef } from "vue";
import {
  BitFrameworkStoreApi,
  BitStoreApi,
  observeHistoryMetaSnapshot,
  readHistoryMetaSnapshot,
} from "../core";
import { resolveVueStore } from "./store";
import type { UseBitHistoryResult } from "./types";

export function useBitHistory<T extends object = any>(
  storeInput: BitFrameworkStoreApi<T> | BitStoreApi<T>,
): UseBitHistoryResult {
  const store = resolveVueStore(storeInput);

  const meta = shallowRef(readHistoryMetaSnapshot(store));

  const unsubscribe = observeHistoryMetaSnapshot(store, (nextMeta) => {
    meta.value = nextMeta;
  });

  onUnmounted(unsubscribe);

  const undo = () => store.feature.undo();
  const redo = () => store.feature.redo();

  return {
    canUndo: computed(() => meta.value.canUndo),
    canRedo: computed(() => meta.value.canRedo),
    historyIndex: computed(() => meta.value.historyIndex),
    historySize: computed(() => meta.value.historySize),
    undo,
    redo,
  };
}
