import { DestroyRef, signal, Signal, inject } from "@angular/core";
import { useBitStore } from "./provider";

export function injectBitWatch<T = any>(path: string): Signal<T> {
  const store = useBitStore();
  const destroyRef = inject(DestroyRef);

  const getVal = () =>
    path.split(".").reduce((p: any, c) => p?.[c], store.getState().values) as T;
  const valueSig = signal<T>(getVal());
  const unsub = store.watch(path, (v) => valueSig.set(v as T));

  destroyRef.onDestroy(unsub);

  return valueSig.asReadonly();
}
