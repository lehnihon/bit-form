import { computed, onUnmounted, shallowRef } from "vue";
import { useBitStore } from "./context";
import { BitFieldOptions, BitFieldDefinition, getDeepValue } from "../core";
import type { UseBitFieldVueMeta, UseBitFieldVueResult } from "./types";

export function useBitField<TValue = any>(
  path: string,
  config?: BitFieldDefinition<any>,
  options?: BitFieldOptions,
): UseBitFieldVueResult<TValue> {
  const store = useBitStore<any>();

  if (config) {
    store.registerField(path as string, config as any);
  }

  const maskOption =
    options?.mask ?? store.config.fields?.[path as string]?.mask;
  const resolvedMask = maskOption
    ? typeof maskOption === "string"
      ? store.config.masks?.[maskOption]
      : maskOption
    : undefined;

  const state = shallowRef(store.getState());

  const unsubscribe = store.subscribe(() => {
    state.value = store.getState();
  });

  onUnmounted(() => {
    unsubscribe();
    if (store.unregisterField) {
      store.unregisterField(path as string);
    }
  });

  const rawValue = computed(
    () => getDeepValue(state.value.values, path as string) as TValue,
  );

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

  const rawError = computed(() => state.value.errors[path]);
  const error = computed(() =>
    state.value.touched[path] ? state.value.errors[path] : undefined,
  );
  const touched = computed(() => !!state.value.touched[path]);
  const invalid = computed(() => !!(touched.value && error.value));

  const isValidating = computed(() => {
    state.value;
    return store.isFieldValidating(path);
  });

  const isDirty = computed(() => {
    state.value;
    return store.isFieldDirty(path);
  });

  const isHidden = computed(() => {
    state.value;
    return store.isHidden(path);
  });

  const isRequired = computed(() => {
    state.value;
    return store.isRequired(path);
  });

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
