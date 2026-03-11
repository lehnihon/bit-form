import { useMemo, useCallback } from "react";
import { useBitFieldBase } from "./use-bit-field-base";
import {
  BitFieldDefinition,
  BitFieldOptions,
  BitPath,
  BitPathValue,
} from "../core";
import type {
  UseBitFieldMeta,
  UseBitFieldBindProps,
  UseBitFieldResult,
} from "./types";

function isMaskOnlyOptions(
  value: BitFieldDefinition<any> | BitFieldOptions | undefined,
): value is BitFieldOptions {
  if (!value || typeof value !== "object") return false;
  const keys = Object.keys(value);
  return keys.length === 1 && keys[0] === "mask";
}

export function useBitField<
  TForm extends object = any,
  P extends BitPath<TForm> = BitPath<TForm>,
>(
  path: P,
  configOrOptions?: BitFieldDefinition<TForm> | BitFieldOptions,
  maybeOptions?: BitFieldOptions,
): UseBitFieldResult<TForm, P> {
  const config =
    maybeOptions !== undefined
      ? (configOrOptions as BitFieldDefinition<TForm> | undefined)
      : isMaskOnlyOptions(configOrOptions)
        ? undefined
        : (configOrOptions as BitFieldDefinition<TForm> | undefined);

  const options =
    maybeOptions !== undefined
      ? maybeOptions
      : isMaskOnlyOptions(configOrOptions)
        ? configOrOptions
        : undefined;

  const {
    fieldState,
    setValue: rawSetValue,
    setBlur,
    store,
  } = useBitFieldBase<BitPathValue<TForm, P>, TForm, P>(path, config);

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

  const { isHidden, isRequired, value, error, touched, isDirty, isValidating } =
    fieldState;

  const invalid = !!(touched && error);
  const visibleError = touched ? error : undefined;

  const onChange = useCallback(
    (e: any) => {
      const val = e?.target ? e.target.value : e;
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
