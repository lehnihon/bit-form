import { useMemo, useCallback, useEffect } from "react";
import { useBitFieldBase } from "../react/use-bit-field-base";
import { BitFieldOptions } from "../core";

export function useBitField<T extends object = any>(
  path: string,
  options?: BitFieldOptions<T>,
) {
  const { fieldState, setValue, setBlur, store } = useBitFieldBase<T>(path);

  useEffect(() => {
    if (options?.dependsOn || options?.showIf || options?.requiredIf) {
      store.registerConfig(path, {
        dependsOn: options.dependsOn,
        showIf: options.showIf,
        requiredIf: options.requiredIf,
      } as any);
    }
  }, [path, store]);

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
  const isHidden = store.isHidden(path);

  return {
    value: fieldState.value as T,
    error: fieldState.touched ? fieldState.error : undefined,
    touched: fieldState.touched,
    invalid: !!(fieldState.touched && fieldState.error),
    isDirty,
    isHidden,
    setValue,
    setBlur,
    props: {
      value: displayValue,
      onChangeText: handleChange,
      onBlur: setBlur,
    },
  };
}
