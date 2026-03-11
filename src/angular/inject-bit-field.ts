import { inject, DestroyRef, computed, signal } from "@angular/core";
import { BIT_STORE_TOKEN } from "./provider";
import {
  BitFieldDefinition,
  BitFieldOptions,
  getDeepValue,
  BitPath,
  BitPathValue,
} from "../core";
import type { InjectBitFieldMeta, InjectBitFieldResult } from "./types";

export function injectBitField<
  TValue = any,
  TForm extends object = any,
  P extends BitPath<TForm> = BitPath<TForm>,
>(
  path: P,
  config?: BitFieldDefinition<TForm>,
  options?: BitFieldOptions,
): InjectBitFieldResult<TForm, P> {
  const store = inject(BIT_STORE_TOKEN);

  const stateSignal = signal(store.getState());

  const unsubscribe = store.subscribe(() => {
    stateSignal.set(store.getState());
  });

  inject(DestroyRef).onDestroy(() => {
    unsubscribe();
    if (store.unregisterField) {
      store.unregisterField(path as string);
    }
  });

  if (config) {
    store.registerField(path as string, config as any);
  }

  const value = computed(
    () =>
      getDeepValue(stateSignal().values, path as string) as BitPathValue<
        TForm,
        P
      >,
  );
  const rawError = computed(
    () =>
      (stateSignal().errors as Record<string, any>)[path] as string | undefined,
  );
  const touched = computed(
    () => !!(stateSignal().touched as Record<string, any>)[path],
  );
  const error = computed(() => (touched() ? rawError() : undefined));

  const isDirty = computed(() => {
    stateSignal();
    return store.isFieldDirty(path);
  });

  const isValidating = computed(() => {
    stateSignal();
    return store.isFieldValidating(path);
  });

  const isHidden = computed(() => {
    stateSignal();
    return store.isHidden(path);
  });

  const isRequired = computed(() => {
    stateSignal();
    return store.isRequired(path);
  });

  const invalid = computed(() => touched() && !!rawError());

  const maskOption =
    options?.mask ?? store.config.fields?.[path as string]?.mask;
  const resolvedMask = maskOption
    ? typeof maskOption === "string"
      ? store.config.masks![maskOption]
      : maskOption
    : undefined;

  const displayValue = computed(() => {
    const val = value();
    if (val === undefined || val === null || val === "") return "";

    return resolvedMask ? resolvedMask.format(val) : String(val);
  });

  const setValue = (val: any) => {
    if (!resolvedMask) {
      store.setField(path, val);
      return;
    }

    const stringVal = String(val ?? "");
    store.setField(path, resolvedMask.parse(stringVal) as any);
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
