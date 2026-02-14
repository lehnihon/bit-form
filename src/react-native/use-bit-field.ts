import { useMemo, useCallback } from "react";
import { useBitFieldBase } from "../react/use-bit-field-base";
import { BitMask } from "../core/mask/types";

export interface UseBitFieldOptions {
  mask?: BitMask | string;
  unmask?: boolean;
}

export function useBitField<T = any>(
  path: string,
  options?: UseBitFieldOptions,
) {
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
    if (val === undefined || val === null) return "";

    if (resolvedMask) {
      return shouldUnmask ? resolvedMask.format(val) : String(val);
    }
    return val != null ? String(val) : "";
  }, [fieldState.value, resolvedMask, shouldUnmask]);

  const handleChange = useCallback(
    (text: string) => {
      if (!resolvedMask) {
        setValue(text as any);
        return;
      }

      if (shouldUnmask) {
        setValue(resolvedMask.parse(text) as any);
      } else {
        setValue(resolvedMask.format(text) as any);
      }
    },
    [resolvedMask, shouldUnmask, setValue],
  );

  const isDirty = store.isFieldDirty(path);

  return {
    value: fieldState.value as T,
    error: fieldState.touched ? fieldState.error : undefined,
    touched: fieldState.touched,
    invalid: !!(fieldState.touched && fieldState.error),
    isDirty,
    setValue,
    setBlur,
    props: {
      value: displayValue,
      onChangeText: handleChange,
      onBlur: setBlur,
    },
  };
}
