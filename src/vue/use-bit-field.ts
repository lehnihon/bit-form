import { computed, onUnmounted, shallowRef } from "vue";
import { useBitStore } from "./context";
import type { UseBitFieldVueResult } from "./types";
import type { BitPath, BitPathValue } from "../core";
import {
  createMaskedFieldController,
  subscribeFieldState,
} from "../core/field-controller";
import { cleanupRegisteredField } from "../core/bindings/framework-cleanup";
import { deriveFieldMeta } from "../core/utils/field-meta";

export function useBitField<
  TForm extends object = any,
  P extends BitPath<TForm> = BitPath<TForm>,
>(path: P): UseBitFieldVueResult<BitPathValue<TForm, P>> {
  const store = useBitStore<TForm>();

  const resolvedMask = store.resolveMask(path);
  const fieldController = createMaskedFieldController(
    store,
    path,
    resolvedMask,
  );

  const state = shallowRef(store.getFieldState(path));

  const unsubscribe = subscribeFieldState(store, path, (nextState) => {
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
