import { ref, computed, onUnmounted } from "vue";
import { useBitStore } from "./context";

export function useBitField<T = any>(path: string) {
  const store = useBitStore();
  const _trigger = ref(0);

  const unsubscribe = store.subscribe(() => {
    _trigger.value++;
  });

  onUnmounted(unsubscribe);

  const getDeepValue = (obj: any, p: string) =>
    p.split(".").reduce((prev: any, curr) => prev?.[curr], obj);

  const value = computed({
    get: () => {
      _trigger.value;
      return getDeepValue(store.getState().values, path) as T;
    },
    set: (val: T) => store.setField(path, val),
  });

  const error = computed(() => {
    _trigger.value;
    const state = store.getState();
    return (state.touched as any)[path]
      ? (state.errors as any)[path]
      : undefined;
  });

  const touched = computed(() => {
    _trigger.value;
    return !!(store.getState().touched as any)[path];
  });

  const invalid = computed(() => !!error.value);

  return {
    value,
    error,
    touched,
    invalid,
    setValue: (val: T) => store.setField(path, val),
    setBlur: () => store.blurField(path),
  };
}
