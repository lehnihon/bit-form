import { ref, onUnmounted, readonly } from "vue";
import { useBitStore } from "./context";
import {
  getDeepValue,
  deepEqual,
  BitPath,
  BitPathValue,
} from "../core";

export function useBitWatch<
  TForm extends object = any,
  P extends BitPath<TForm> = BitPath<TForm>,
>(path: P) {
  const store = useBitStore<TForm>();
  const initialValue = getDeepValue(
    store.getState().values,
    path as string,
  ) as BitPathValue<TForm, P>;
  const value = ref<BitPathValue<TForm, P>>(initialValue);

  const unsubscribe = store.watch(path, (newValue) => {
    if (!deepEqual(value.value, newValue)) {
      value.value = newValue as BitPathValue<TForm, P>;
    }
  });

  onUnmounted(unsubscribe);

  return readonly(value);
}
