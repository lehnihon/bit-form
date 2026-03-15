import { useMemo, useCallback } from "react";
import { useBitFieldBase } from "./use-bit-field-base";
import { BitPath, BitPathValue } from "../core";
import {
  formatMaskedValue,
  parseMaskedInput,
} from "../core/mask/field-binding";
import type {
  BitFieldInputEvent,
  UseBitFieldMeta,
  UseBitFieldBindProps,
  UseBitFieldResult,
} from "./types";

function isBitFieldInputEventObject(
  value: BitFieldInputEvent,
): value is Extract<
  BitFieldInputEvent,
  { target?: { value?: string | number | null } }
> {
  return value != null && typeof value === "object" && "target" in value;
}

export function useBitField<
  TForm extends object = any,
  P extends BitPath<TForm> = BitPath<TForm>,
>(path: P): UseBitFieldResult<TForm, P> {
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

  const setValue = useCallback(
    (val: BitPathValue<TForm, P> | string | number | null | undefined) =>
      rawSetValue(
        parseMaskedInput(val, resolvedMask ?? undefined) as BitPathValue<
          TForm,
          P
        >,
      ),
    [resolvedMask, rawSetValue],
  );

  const { isHidden, isRequired, value, error, touched, isDirty, isValidating } =
    fieldState;

  const invalid = !!(touched && error);
  const visibleError = touched ? error : undefined;

  const onChange = useCallback(
    (e: BitFieldInputEvent) => {
      const val = isBitFieldInputEventObject(e) ? e.target?.value : e;
      setValue(val);
    },
    [setValue],
  );

  const onBlur = useCallback(() => {
    setBlur();
  }, [setBlur]);

  return {
    // Main handlers and values (flat)
    value: value as BitPathValue<TForm, P>,
    displayValue,
    setValue,
    setBlur,
    onChange,
    onBlur,
    // Props helper
    props: {
      value: displayValue,
      onChange,
      onBlur,
    },
    // Metadata (grouped)
    meta: {
      error: visibleError,
      touched,
      invalid,
      isDirty,
      isValidating,
      isHidden,
      isRequired,
      hasError: !!error,
    },
  };
}
