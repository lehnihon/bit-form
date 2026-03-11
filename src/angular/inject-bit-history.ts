import { computed, DestroyRef, inject, signal } from "@angular/core";
import { useBitStore } from "./provider";
import type { InjectBitHistoryResult } from "./types";

export function injectBitHistory<
  T extends object = any,
>(): InjectBitHistoryResult {
  const store = useBitStore<T>();
  const destroyRef = inject(DestroyRef);

  const meta = signal(store.getHistoryMetadata());

  const sub = store.subscribe(() => {
    meta.set(store.getHistoryMetadata());
  });

  destroyRef.onDestroy(() => sub());

  return {
    canUndo: computed(() => meta().canUndo),
    canRedo: computed(() => meta().canRedo),
    historyIndex: computed(() => meta().historyIndex),
    historySize: computed(() => meta().historySize),
    undo: () => store.undo(),
    redo: () => store.redo(),
  };
}
