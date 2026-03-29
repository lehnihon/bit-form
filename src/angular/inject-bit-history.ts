import { computed, DestroyRef, inject, signal } from "@angular/core";
import { observeHistoryMetaSnapshot, readHistoryMetaSnapshot } from "../core";
import { useBitStore } from "./provider";
import type { InjectBitHistoryResult } from "./types";

export function injectBitHistory<
  T extends object = any,
>(): InjectBitHistoryResult {
  const store = useBitStore<T>();
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
