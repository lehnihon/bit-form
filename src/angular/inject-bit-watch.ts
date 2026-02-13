import { DestroyRef, signal, Signal, inject } from "@angular/core";
import { useBitStore } from "./provider";
import { getDeepValue, deepEqual } from "../core";

export function injectBitWatch<T = any>(path: string): Signal<T> {
  const store = useBitStore();
  const destroyRef = inject(DestroyRef);
  const valueSig = signal<T>(getDeepValue(store.getState().values, path) as T, {
    equal: deepEqual,
  });

  const unsub = store.watch(path, (v) => {
    valueSig.set(v as T);
  });

  destroyRef.onDestroy(unsub);

  return valueSig.asReadonly();
}
