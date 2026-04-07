import { onUnmounted, readonly, ref } from "vue";
import {
  BitFrameworkStoreApi,
  BitPath,
  BitPathValue,
  BitStoreApi,
  getDeepValue,
  valueEqual,
} from "../core";
import { resolveVueStore } from "./store";

export function useBitWatch<
  TForm extends object = any,
  P extends BitPath<TForm> = BitPath<TForm>,
>(storeInput: BitFrameworkStoreApi<TForm> | BitStoreApi<TForm>, path: P) {
  const store = resolveVueStore(storeInput);
  const initialValue = getDeepValue(
    store.read.getState().values,
    path as string,
  ) as BitPathValue<TForm, P>;
  const value = ref<BitPathValue<TForm, P>>(initialValue);

  const unsubscribe = store.observe.subscribePath(path, (newValue) => {
    if (!valueEqual(value.value, newValue)) {
      value.value = newValue as BitPathValue<TForm, P>;
    }
  });

  onUnmounted(unsubscribe);

  return readonly(value);
}
