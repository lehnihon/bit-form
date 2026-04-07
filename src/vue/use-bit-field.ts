import { computed, onUnmounted, shallowRef } from "vue";
import type {
  BitFrameworkStoreApi,
  BitPath,
  BitPathValue,
  BitStoreApi,
} from "../core";
import {
  cleanupRegisteredField,
  createFrameworkMaskedFieldBinding,
  deriveFieldMeta,
} from "../core";
import { resolveVueStore } from "./store";
import type { UseBitFieldVueResult } from "./types";

export function useBitField<
  TForm extends object = any,
  P extends BitPath<TForm> = BitPath<TForm>,
>(
  storeInput: BitFrameworkStoreApi<TForm> | BitStoreApi<TForm>,
  path: P,
): UseBitFieldVueResult<BitPathValue<TForm, P>> {
  const store = resolveVueStore(storeInput);

  const { fieldController } = createFrameworkMaskedFieldBinding(store, path);

  const state = shallowRef(store.read.getFieldState(path));

  const unsubscribe = store.observe.subscribeFieldState(path, (nextState) => {
    state.value = nextState;
  });

  onUnmounted(() => {
    unsubscribe();
    cleanupRegisteredField(store, path as string);
  });

  const rawValue = computed(() => state.value.value as BitPathValue<TForm, P>);

  const displayValue = computed(() =>
    fieldController.displayValue(rawValue.value),
  );

  const modelValue = computed({
    get: () => displayValue.value,
    set: (val: string) => {
      fieldController.setValue(val);
    },
  });

  const metaState = computed(() => deriveFieldMeta(state.value));
  const error = computed(() => metaState.value.error);
  const touched = computed(() => metaState.value.touched);
  const invalid = computed(() => metaState.value.invalid);
  const isValidating = computed(() => metaState.value.isValidating);
  const isDirty = computed(() => metaState.value.isDirty);
  const isHidden = computed(() => metaState.value.isHidden);
  const isRequired = computed(() => metaState.value.isRequired);
  const hasError = computed(() => metaState.value.hasError);

  const setValue = (
    val: BitPathValue<TForm, P> | string | number | null | undefined,
  ) => {
    fieldController.setValue(val);
  };

  const setBlur = () => fieldController.setBlur();

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
