import { computed, onUnmounted, shallowRef } from "vue";
import { useBitStore } from "./context";
import type { UseBitFieldVueMeta, UseBitFieldVueResult } from "./types";

export function useBitField<TValue = any>(
  path: string,
): UseBitFieldVueResult<TValue> {
  const store = useBitStore<any>();

  const resolvedMask = store.resolveMask(path as string);

  const state = shallowRef(store.getFieldState(path as string));

  const unsubscribe = store.subscribeSelector(
    () => store.getFieldState(path as string),
    (nextState) => {
      state.value = nextState;
    },
  );

  onUnmounted(() => {
    unsubscribe();
    if (store.unregisterField) {
      store.unregisterField(path as string);
    }
  });

  const rawValue = computed(() => state.value.value as TValue);

  const displayValue = computed(() => {
    const val = rawValue.value;
    if (val === undefined || val === null || val === "") return "";

    return resolvedMask ? resolvedMask.format(val as any) : String(val);
  });

  const modelValue = computed({
    get: () => displayValue.value,
    set: (val: any) => {
      if (!resolvedMask) {
        store.setField(path, val);
        return;
      }

      store.setField(path, resolvedMask.parse(String(val ?? "")));
    },
  });

  const rawError = computed(() => state.value.error);
  const error = computed(() =>
    state.value.touched ? state.value.error : undefined,
  );
  const touched = computed(() => state.value.touched);
  const invalid = computed(() => !!(touched.value && error.value));

  const isValidating = computed(() => state.value.isValidating);

  const isDirty = computed(() => state.value.isDirty);

  const isHidden = computed(() => state.value.isHidden);

  const isRequired = computed(() => state.value.isRequired);

  const hasError = computed(() => !!rawError.value);

  const setValue = (val: any) => {
    modelValue.value = val;
  };

  const setBlur = () => store.blurField(path);

  const onInput = (val: any) => {
    setValue(val);
  };

  const onBlur = () => {
    setBlur();
  };

  return {
    // Main handlers and values (flat)
    value: rawValue,
    displayValue,
    modelValue,
    setValue,
    setBlur,
    onInput,
    onBlur,
    // Metadata (grouped)
    meta: {
      error,
      touched,
      invalid,
      isValidating,
      isDirty,
      isHidden,
      isRequired,
      hasError,
    },
  };
}
