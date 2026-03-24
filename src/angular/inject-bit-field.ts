import { inject, DestroyRef, computed, signal } from "@angular/core";
import { BIT_STORE_TOKEN } from "./provider";
import {
  BitPath,
  BitPathValue,
  cleanupRegisteredField,
  createFrameworkMaskedFieldBinding,
  deriveFieldMeta,
  isBitFieldInputEventObject,
  subscribeFieldState,
} from "../core";
import type {
  BitFieldInputEvent,
  InjectBitFieldMeta,
  InjectBitFieldResult,
} from "./types";

export function injectBitField<
  TValue = any,
  TForm extends object = any,
  P extends BitPath<TForm> = BitPath<TForm>,
>(path: P): InjectBitFieldResult<TForm, P> {
  const store = inject(BIT_STORE_TOKEN);

  const stateSignal = signal(store.getFieldState(path));

  const unsubscribe = subscribeFieldState(store, path, (nextState) => {
    stateSignal.set(nextState);
  });

  inject(DestroyRef).onDestroy(() => {
    unsubscribe();
    cleanupRegisteredField(store, path as string);
  });

  const value = computed(() => stateSignal().value as BitPathValue<TForm, P>);
  const metaState = computed(() => deriveFieldMeta(stateSignal()));
  const error = computed(() => metaState().error);
  const touched = computed(() => metaState().touched);
  const invalid = computed(() => metaState().invalid);
  const isDirty = computed(() => metaState().isDirty);
  const isValidating = computed(() => metaState().isValidating);
  const isHidden = computed(() => metaState().isHidden);
  const isRequired = computed(() => metaState().isRequired);

  const { fieldController } = createFrameworkMaskedFieldBinding(store, path);

  const displayValue = computed(() => fieldController.displayValue(value()));

  const setValue = (
    val: BitPathValue<TForm, P> | string | number | null | undefined,
  ) => {
    fieldController.setValue(val);
  };

  const setBlur = () => fieldController.setBlur();

  const hasError = computed(() => metaState().hasError);

  const update = (e: BitFieldInputEvent) =>
    setValue(isBitFieldInputEventObject(e) ? (e.target?.value ?? null) : e);

  return {
    // Main handlers and values (flat)
    value,
    displayValue,
    setValue,
    setBlur,
    update,
    // Metadata (grouped)
    meta: {
      error,
      touched,
      invalid,
      isDirty,
      isValidating,
      isHidden,
      isRequired,
      hasError,
    },
  };
}
