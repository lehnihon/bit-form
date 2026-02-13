import { ref, onUnmounted, readonly } from "vue";
import { useBitStore } from "./context";
import { getDeepValue } from "../core";

export function useBitWatch<T = any>(path: string) {
  const store = useBitStore();

  const value = ref<T>(getDeepValue(store.getState().values, path)) as any;

  const unsubscribe = store.watch(path, (newValue) => {
    value.value = newValue;
  });

  onUnmounted(unsubscribe);

  return readonly(value);
}
