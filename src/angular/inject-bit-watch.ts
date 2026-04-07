import { DestroyRef, inject, signal, Signal } from "@angular/core";
import {
  BitFrameworkStoreApi,
  BitPath,
  BitPathValue,
  BitStoreApi,
  getDeepValue,
  valueEqual,
} from "../core";
import { resolveAngularStore } from "./store";

export function injectBitWatch<
  TForm extends object = any,
  P extends BitPath<TForm> = BitPath<TForm>,
>(
  storeInput: BitFrameworkStoreApi<TForm> | BitStoreApi<TForm>,
  path: P,
): Signal<BitPathValue<TForm, P>> {
  const store = resolveAngularStore(storeInput);
  const destroyRef = inject(DestroyRef);
  const valueSig = signal<BitPathValue<TForm, P>>(
    getDeepValue(store.read.getState().values, path as string) as BitPathValue<
      TForm,
      P
    >,
    { equal: valueEqual },
  );

  const unsub = store.observe.subscribePath(path, (v) => {
    valueSig.set(v as BitPathValue<TForm, P>);
  });

  destroyRef.onDestroy(unsub);

  return valueSig.asReadonly();
}
