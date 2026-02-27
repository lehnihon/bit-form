import { useMemo, useCallback } from "react";
import { useBitFieldBase } from "./use-bit-field-base";
import { BitFieldOptions, BitPath, BitPathValue } from "../core";

export function useBitField<
  TForm extends object = any,
  P extends BitPath<TForm> = BitPath<TForm>,
>(path: P, options?: BitFieldOptions) {
  const {
    fieldState,
    setValue: rawSetValue,
    setBlur,
    store,
  } = useBitFieldBase<BitPathValue<TForm, P>, TForm, P>(path);

  const resolvedMask = useMemo(() => {
    const maskOption =
      options?.mask ?? store.config.fields?.[path as string]?.mask;
    if (!maskOption) return undefined;
    return typeof maskOption === "string"
      ? store.config.masks![maskOption]
      : maskOption;
  }, [options?.mask, store.config.masks, store.config.fields, path]);

  const displayValue = useMemo(() => {
    const val = fieldState.value;
    if (val === undefined || val === null || val === "") return "";

    return resolvedMask ? resolvedMask.format(val) : String(val);
  }, [fieldState.value, resolvedMask]);

  const setValue = useCallback(
    (val: any) => {
      if (!resolvedMask) {
        rawSetValue(val);
        return;
      }

      rawSetValue(resolvedMask.parse(String(val ?? "")) as any);
    },
    [resolvedMask, rawSetValue],
  );

  const {
    isHidden,
    isRequired,
    value,
    error,
    touched,
    isDirty,
    isValidating,
  } = fieldState;

  const invalid = !!(touched && error);

  return {
    value: value as BitPathValue<TForm, P>,
    displayValue,
    error: touched ? error : undefined,
    touched: touched,
    invalid,
    isValidating,
    isDirty,
    isHidden,
    isRequired,
    fieldMeta: {
      isDirty,
      isValidating,
      isHidden,
      isRequired,
      hasError: !!error,
    },
    setValue,
    setBlur,
    props: {
      value: displayValue,
      onChange: (e: any) => {
        const val = e?.target ? e.target.value : e;
        setValue(val);
      },
      onBlur: setBlur,
    },
  };
}
