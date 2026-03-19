import { useMemo, useCallback, useSyncExternalStore } from "react";
import { useBitFieldBase } from "./use-bit-field-base";
import { BitPath, BitPathValue } from "../core";
import {
  formatMaskedValue,
  parseMaskedInput,
  isBitFieldInputEventObject,
} from "../core/mask/field-binding";
import { deriveFieldMeta } from "../core/utils/field-meta";
import type {
  BitFieldInputEvent,
  UseBitFieldMeta,
  UseBitFieldBindProps,
  UseBitFieldResult,
} from "./types";

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

  // Track mask registrations reactively. getMasksVersion() returns a counter
  // that increments on every registerMask() call. useSyncExternalStore fires
  // the snapshot on every store notification; the integer comparison is O(1)
  // so this only triggers a re-render when a mask is actually added.
  const masksVersion = useSyncExternalStore(
    // store.subscribe fires on every state change (global listener)
    (cb) => store.subscribe(cb),
    () => store.getMasksVersion(),
    () => store.getMasksVersion(),
  );

  const resolvedMask = useMemo(() => {
    return store.resolveMask(path as string);
  }, [masksVersion, store.config.fields, path]);

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

  const { value } = fieldState;
  const metaState = deriveFieldMeta(fieldState);

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
      error: metaState.error,
      touched: metaState.touched,
      invalid: metaState.invalid,
      isDirty: metaState.isDirty,
      isValidating: metaState.isValidating,
      isHidden: metaState.isHidden,
      isRequired: metaState.isRequired,
      hasError: metaState.hasError,
    },
  };
}
