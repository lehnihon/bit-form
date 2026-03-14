import { inject, DestroyRef, computed, signal } from "@angular/core";
import { BIT_STORE_TOKEN } from "./provider";
import { BitPath, BitPathValue } from "../core";
import {
  formatMaskedValue,
  parseMaskedInput,
} from "../core/mask/field-binding";
import type { InjectBitFieldMeta, InjectBitFieldResult } from "./types";

export function injectBitField<
  TValue = any,
  TForm extends object = any,
  P extends BitPath<TForm> = BitPath<TForm>,
>(path: P): InjectBitFieldResult<TForm, P> {
  const store = inject(BIT_STORE_TOKEN);

  const stateSignal = signal(store.getFieldState(path));

  const unsubscribe = store.subscribeSelector(
    () => store.getFieldState(path),
    (nextState) => {
      stateSignal.set(nextState);
    },
  );

  inject(DestroyRef).onDestroy(() => {
    unsubscribe();
    if (store.unregisterField) {
      store.unregisterField(path as string);
    }
  });

  const value = computed(() => stateSignal().value as BitPathValue<TForm, P>);
  const rawError = computed(() => stateSignal().error);
  const touched = computed(() => stateSignal().touched);
  const error = computed(() => (touched() ? rawError() : undefined));

  const isDirty = computed(() => stateSignal().isDirty);

  const isValidating = computed(() => stateSignal().isValidating);

  const isHidden = computed(() => stateSignal().isHidden);

  const isRequired = computed(() => stateSignal().isRequired);

  const invalid = computed(() => touched() && !!rawError());

  const resolvedMask = store.resolveMask(path as string);

  const displayValue = computed(() =>
    formatMaskedValue(value(), resolvedMask ?? undefined),
  );

  const setValue = (val: any) => {
    store.setField(
      path,
      parseMaskedInput(val, resolvedMask ?? undefined) as any,
    );
  };

  const setBlur = () => store.blurField(path);

  const hasError = computed(() => !!rawError());

  const update = (e: any) => setValue(e?.target?.value ?? e);

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
