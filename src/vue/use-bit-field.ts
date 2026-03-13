import { computed, onUnmounted, shallowRef } from "vue";
import { useBitStore } from "./context";
import type { UseBitFieldVueResult } from "./types";
import type { BitPath, BitPathValue } from "../core";

export function useBitField<
  TForm extends object = any,
  P extends BitPath<TForm> = BitPath<TForm>,
>(path: P): UseBitFieldVueResult<BitPathValue<TForm, P>> {
  const store = useBitStore<TForm>();

  const resolvedMask = store.resolveMask(path);

  const state = shallowRef(store.getFieldState(path));

  const unsubscribe = store.subscribeSelector(
    () => store.getFieldState(path),
    (nextState) => {
      state.value = nextState;
    },
  );

  onUnmounted(() => {
    unsubscribe();
    if (store.unregisterField) {
      store.unregisterField(path);
    }
  });

  const rawValue = computed(() => state.value.value as BitPathValue<TForm, P>);

  const displayValue = computed(() => {
    const val = rawValue.value;
    if (val === undefined || val === null || val === "") return "";

    return resolvedMask ? resolvedMask.format(val) : String(val);
  });

  const modelValue = computed({
    get: () => displayValue.value,
    set: (val: string) => {
      if (!resolvedMask) {
        store.setField(path, val as BitPathValue<TForm, P>);
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

  const setValue = (
    val: BitPathValue<TForm, P> | string | number | null | undefined,
  ) => {
    if (!resolvedMask) {
      store.setField(path, val as BitPathValue<TForm, P>);
      return;
    }

    modelValue.value = String(val ?? "");
  };

  const setBlur = () => store.blurField(path);

  const onInput = (
    val: BitPathValue<TForm, P> | string | number | null | undefined,
  ) => {
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
