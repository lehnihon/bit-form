import { useMemo, useCallback } from "react";
import { useBitFieldBase } from "../react/use-bit-field-base";
import { BitPath, BitPathValue } from "../core";
import {
  formatMaskedValue,
  parseMaskedInput,
} from "../core/mask/field-binding";
import type { UseBitFieldNativeResult } from "./types";

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

  const displayValue = useMemo(
    () => formatMaskedValue(fieldState.value, resolvedMask ?? undefined),
    [fieldState.value, resolvedMask],
  );

  const handleChange = useCallback(
    (text: string) =>
      rawSetValue(parseMaskedInput(text, resolvedMask ?? undefined) as any),
    [resolvedMask, rawSetValue],
  );

  const setValue = useCallback(
    (val: any) =>
      rawSetValue(parseMaskedInput(val, resolvedMask ?? undefined) as any),
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
    value: value as BitPathValue<TForm, P>,
    displayValue,
    setValue,
    setBlur,
    onChangeText: handleChange,
    onBlur,
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
