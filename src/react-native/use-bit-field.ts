import { useMemo, useCallback } from "react";
import { useBitFieldBase } from "../react/use-bit-field-base";
import { BitPath, BitPathValue } from "../core";
import type {
  UseBitFieldNativeMeta,
  UseBitFieldNativeBindProps,
  UseBitFieldNativeResult,
} from "./types";

export function useBitField<
  TForm extends object = any,
  P extends BitPath<TForm> = BitPath<TForm>,
>(path: P): UseBitFieldNativeResult<TForm, P> {
  const {
    fieldState,
    setValue: rawSetValue,
    setBlur,
    store,
  } = useBitFieldBase<BitPathValue<TForm, P>, TForm, P>(path);

  const resolvedMask = useMemo(() => {
    return store.resolveMask(path as string);
  }, [store.config.masks, store.config.fields, path]);

  const displayValue = useMemo(() => {
    const val = fieldState.value;
    if (val === undefined || val === null || val === "") return "";

    return resolvedMask ? resolvedMask.format(val) : String(val);
  }, [fieldState.value, resolvedMask]);

  const handleChange = useCallback(
    (text: string) => {
      if (!resolvedMask) {
        rawSetValue(text as any);
        return;
      }

      rawSetValue(resolvedMask.parse(String(text ?? "")) as any);
    },
    [resolvedMask, rawSetValue],
  );

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

  const { isHidden, isRequired, value, error, touched, isDirty, isValidating } =
    fieldState;
  const invalid = !!(touched && error);
  const visibleError = touched ? error : undefined;

  const onBlur = useCallback(() => {
    setBlur();
  }, [setBlur]);

  return {
    field: {
      value: value as BitPathValue<TForm, P>,
      displayValue,
      setValue,
      setBlur,
      onChangeText: handleChange,
      onBlur,
    },
    meta: {
      error: visibleError,
      touched,
      invalid,
      isValidating,
      isDirty,
      isHidden,
      isRequired,
      hasError: !!error,
    },
    props: {
      value: displayValue,
      onChangeText: handleChange,
      onBlur,
    },
  };
}
