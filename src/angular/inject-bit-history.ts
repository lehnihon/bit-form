import { computed, DestroyRef, inject, signal } from "@angular/core";
import {
  BitFrameworkStoreApi,
  BitStoreApi,
  observeHistoryMetaSnapshot,
  readHistoryMetaSnapshot,
} from "../core";
import { resolveAngularStore } from "./store";
import type { InjectBitHistoryResult } from "./types";

export function injectBitHistory<T extends object = any>(
  storeInput: BitFrameworkStoreApi<T> | BitStoreApi<T>,
): InjectBitHistoryResult {
  const store = resolveAngularStore(storeInput);
  const destroyRef = inject(DestroyRef);

  const meta = signal(readHistoryMetaSnapshot(store));

  const sub = observeHistoryMetaSnapshot(store, (nextMeta) => {
    meta.set(nextMeta);
  });

  destroyRef.onDestroy(() => sub());

  return {
    canUndo: computed(() => meta().canUndo),
    canRedo: computed(() => meta().canRedo),
    historyIndex: computed(() => meta().historyIndex),
    historySize: computed(() => meta().historySize),
    undo: () => store.feature.undo(),
    redo: () => store.feature.redo(),
  };
}
