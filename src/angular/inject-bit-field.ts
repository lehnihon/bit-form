import { inject, DestroyRef, computed, signal } from "@angular/core";
import { BIT_STORE_TOKEN } from "./provider";
import { BitFieldConfig, BitFieldOptions, getDeepValue } from "../core";

export function injectBitField<TValue = any, TForm extends object = any>(
  path: string,
  config?: BitFieldConfig<TForm>,
  options?: BitFieldOptions,
) {
  const store = inject(BIT_STORE_TOKEN);

  const stateSignal = signal(store.getState());

  const unsubscribe = store.subscribe(() => {
    stateSignal.set(store.getState());
  });

  inject(DestroyRef).onDestroy(() => {
    unsubscribe();
    if (store.unregisterField) {
      store.unregisterField(path);
    }
  });

  if (config) {
    store.registerConfig(path, config as any);
  }

  const value = computed(
    () => getDeepValue(stateSignal().values, path) as TValue,
  );
  const error = computed(
    () => (stateSignal().errors as Record<string, any>)[path],
  );
  const touched = computed(
    () => !!(stateSignal().touched as Record<string, any>)[path],
  );

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

  const invalid = computed(() => touched() && !!error());

  const resolvedMask = options?.mask
    ? typeof options.mask === "string"
      ? store.masks[options.mask]
      : options.mask
    : undefined;

  const displayValue = computed(() => {
    const val = value();
    if (val === undefined || val === null || val === "") return "";
    if (resolvedMask) {
      return (options?.unmask ?? store.defaultUnmask ?? true)
        ? resolvedMask.format(val)
        : String(val);
    }
    return String(val);
  });

  const setValue = (val: any) => {
    let finalValue = val;
    if (resolvedMask) {
      const stringVal = String(val ?? "");
      finalValue =
        (options?.unmask ?? store.defaultUnmask ?? true)
          ? (resolvedMask.parse(stringVal) as any)
          : resolvedMask.format(stringVal);
    }
    store.setField(path, finalValue);
  };

  const setBlur = () => store.blurField(path);

  return {
    value,
    displayValue,
    error,
    touched,
    invalid,
    isDirty,
    isValidating,
    isHidden,
    isRequired,
    setValue,
    setBlur,
    update: (e: any) => setValue(e?.target?.value ?? e),
  };
}
