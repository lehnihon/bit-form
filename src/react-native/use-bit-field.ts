import { useMemo, useCallback } from "react";
import { useBitFieldBase } from "../react/use-bit-field-base";
import { BitFieldOptions } from "../core";

export function useBitField<T = any>(path: string, options?: BitFieldOptions) {
  const { fieldState, setValue, setBlur, store } = useBitFieldBase<T>(path);

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

  const handleChange = useCallback(
    (text: string) => {
      if (!resolvedMask) {
        setValue(text as any);
        return;
      }

      const stringVal = String(text ?? "");

      if (shouldUnmask) {
        setValue(resolvedMask.parse(stringVal) as any);
      } else {
        setValue(resolvedMask.format(stringVal) as any);
      }
    },
    [resolvedMask, shouldUnmask, setValue],
  );

  const { isHidden, isRequired, value, error, touched } = fieldState;

  const isDirty = store.isFieldDirty(path);

  return {
    value: value as T,
    displayValue,
    error: touched ? error : undefined,
    touched: touched,
    invalid: !!(touched && error),
    isDirty,
    isHidden,
    isRequired,
    setValue,
    setBlur,
    props: {
      value: displayValue,
      onChangeText: handleChange,
      onBlur: setBlur,
    },
  };
}
