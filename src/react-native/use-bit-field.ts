import { useMemo, useCallback } from "react";
import { useBitFieldBase } from "../react/use-bit-field-base";
import { BitPath, BitPathValue } from "../core";
import {
  formatMaskedValue,
  parseMaskedInput,
} from "../core/mask/field-binding";
import { deriveFieldMeta } from "../core/utils/field-meta";
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

  const { value } = fieldState;
  const metaState = deriveFieldMeta(fieldState);

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
      error: metaState.error,
      touched: metaState.touched,
      invalid: metaState.invalid,
      isValidating: metaState.isValidating,
      isDirty: metaState.isDirty,
      isHidden: metaState.isHidden,
      isRequired: metaState.isRequired,
      hasError: metaState.hasError,
    },
    props: {
      value: displayValue,
      onChangeText: handleChange,
      onBlur,
    },
  };
}
