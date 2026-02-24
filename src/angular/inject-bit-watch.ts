import { DestroyRef, signal, Signal, inject } from "@angular/core";
import { useBitStore } from "./provider";
import {
  getDeepValue,
  deepEqual,
  BitPath,
  BitPathValue,
} from "../core";

export function injectBitWatch<
  TForm extends object = any,
  P extends BitPath<TForm> = BitPath<TForm>,
>(path: P): Signal<BitPathValue<TForm, P>> {
  const store = useBitStore<TForm>();
  const destroyRef = inject(DestroyRef);
  const valueSig = signal<BitPathValue<TForm, P>>(
    getDeepValue(store.getState().values, path as string) as BitPathValue<
      TForm,
      P
    >,
    { equal: deepEqual },
  );

  const unsub = store.watch(path, (v) => {
    valueSig.set(v as BitPathValue<TForm, P>);
  });

  destroyRef.onDestroy(unsub);

  return valueSig.asReadonly();
}
