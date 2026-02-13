import { ref, onUnmounted, readonly } from "vue";
import { useBitStore } from "./context";
import { getDeepValue, deepEqual } from "../core";

export function useBitWatch<T = any>(path: string) {
  const store = useBitStore();
  const initialValue = getDeepValue(store.getState().values, path) as T;
  const value = ref<T>(initialValue);

  const unsubscribe = store.watch(path, (newValue) => {
    if (!deepEqual(value.value, newValue)) {
      value.value = newValue;
    }
  });

  onUnmounted(unsubscribe);

  return readonly(value);
}
