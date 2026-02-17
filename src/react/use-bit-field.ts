import { useMemo, useCallback } from "react";
import { useBitFieldBase } from "./use-bit-field-base";
import { BitFieldOptions } from "../core";

export function useBitField<T = any>(path: string, options?: BitFieldOptions) {
  const {
    fieldState,
    setValue: rawSetValue,
    setBlur,
    store,
  } = useBitFieldBase<T>(path);

  const resolvedMask = useMemo(() => {
    const maskOption = options?.mask;
    if (!maskOption) return undefined;
    return typeof maskOption === "string"
      ? store.masks[maskOption]
      : maskOption;
  }, [options?.mask, store.masks]);

  const shouldUnmask = options?.unmask ?? store.defaultUnmask ?? true;

  const displayValue = useMemo(() => {
    const val = fieldState.value;
    if (val === undefined || val === null || val === "") return "";

    if (resolvedMask) {
      return shouldUnmask ? resolvedMask.format(val) : String(val);
    }
    return String(val);
  }, [fieldState.value, resolvedMask, shouldUnmask]);

  const setValue = useCallback(
    (val: any) => {
      if (!resolvedMask) {
        rawSetValue(val);
        return;
      }

      const stringVal = String(val ?? "");

      if (shouldUnmask) {
        rawSetValue(resolvedMask.parse(stringVal) as any);
      } else {
        rawSetValue(resolvedMask.format(stringVal) as any);
      }
    },
    [resolvedMask, shouldUnmask, rawSetValue],
  );

  const { isHidden, isRequired, value, error, touched } = fieldState;

  return {
    value: value as T,
    displayValue,
    error: touched ? error : undefined,
    touched: touched,
    invalid: !!(touched && error),
    isValidating: store.isFieldValidating(path),
    isDirty: store.isFieldDirty(path),
    isHidden,
    isRequired,
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
