import { computed, onUnmounted, shallowRef } from "vue";
import { useBitStore } from "./context";
import { BitFieldOptions, BitFieldConfig, getDeepValue } from "../core";

export function useBitField<TValue = any, TForm extends object = any>(
  path: string,
  config?: BitFieldConfig<TForm>,
  options?: BitFieldOptions,
) {
  const store = useBitStore();

  if (config) {
    store.registerConfig(path, config as any);
  }

  const resolvedMask = options?.mask
    ? typeof options.mask === "string"
      ? store.masks?.[options.mask]
      : options.mask
    : undefined;

  const shouldUnmask = options?.unmask ?? store.defaultUnmask ?? true;

  const state = shallowRef(store.getState());

  const unsubscribe = store.subscribe(() => {
    state.value = store.getState();
  });

  onUnmounted(() => {
    unsubscribe();
    if (store.unregisterField) {
      store.unregisterField(path);
    }
  });

  const rawValue = computed(() => {
    return getDeepValue(state.value.values, path) as TValue;
  });

  const displayValue = computed(() => {
    const val = rawValue.value;
    if (val === undefined || val === null || val === "") return "";
    if (resolvedMask) {
      return shouldUnmask ? resolvedMask.format(val as any) : String(val);
    }
    return String(val);
  });

  const value = computed({
    get: () => displayValue.value,
    set: (val: any) => {
      if (!resolvedMask) {
        store.setField(path, val);
        return;
      }
      const stringVal = String(val ?? "");
      if (shouldUnmask) {
        store.setField(path, resolvedMask.parse(stringVal));
      } else {
        store.setField(path, resolvedMask.format(stringVal));
      }
    },
  });

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

  return {
    value,
    displayValue,
    error,
    touched,
    invalid,
    isValidating,
    isDirty,
    isHidden,
    isRequired,
    setBlur: () => store.blurField(path),
    setValue: (val: any) => (value.value = val),
  };
}
