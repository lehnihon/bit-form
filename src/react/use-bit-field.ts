import { useMemo, useCallback, useEffect } from "react";
import { useBitFieldBase } from "./use-bit-field-base";
import { BitFieldOptions } from "../core";

export function useBitField<T extends object = any>(
  path: string,
  options?: BitFieldOptions<T>,
) {
  const {
    fieldState,
    setValue: rawSetValue,
    setBlur,
    store,
  } = useBitFieldBase<T>(path);

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

  const isDirty = store.isFieldDirty(path);
  const isHidden = store.isHidden(path);

  return {
    value: fieldState.value as T,
    displayValue,
    error: fieldState.touched ? fieldState.error : undefined,
    touched: fieldState.touched,
    invalid: !!(fieldState.touched && fieldState.error),
    isDirty,
    isHidden,
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
