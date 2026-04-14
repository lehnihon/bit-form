import { useCallback, useMemo } from "react";
import {
  BitPath,
  BitPathValue,
  createFrameworkMaskedFieldBinding,
  deriveFieldMeta,
  isBitFieldInputEventObject,
} from "../core";
import type { BitFieldInputEvent, UseBitFieldResult } from "./types";
import { useBitFieldBase } from "./use-bit-field-base";

export function useBitField<
  TForm extends object = any,
  P extends BitPath<TForm> = BitPath<TForm>,
>(path: P): UseBitFieldResult<TForm, P> {
  const { fieldState, setBlur, store } = useBitFieldBase<
    BitPathValue<TForm, P>,
    TForm,
    P
  >(path);

  const { fieldController } = useMemo(() => {
    return createFrameworkMaskedFieldBinding(store, path);
  }, [store, path]);

  const displayValue = useMemo(
    () => fieldController.displayValue(fieldState.value),
    [fieldState.value, fieldController],
  );

  const setValue = useCallback(
    (val: BitPathValue<TForm, P> | string | number | null | undefined) => {
      fieldController.setValue(val);
    },
    [fieldController],
  );

  const { value } = fieldState;
  const metaState = deriveFieldMeta(fieldState);
  const {
    error,
    touched,
    invalid,
    isDirty,
    isValidating,
    isHidden,
    isRequired,
    hasError,
  } = metaState;

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

  const props = useMemo(
    () => ({
      value: displayValue,
      onChange,
      onBlur,
    }),
    [displayValue, onChange, onBlur],
  );

  const meta = useMemo(
    () => ({
      error,
      touched,
      invalid,
      isDirty,
      isValidating,
      isHidden,
      isRequired,
      hasError,
    }),
    [
      error,
      touched,
      invalid,
      isDirty,
      isValidating,
      isHidden,
      isRequired,
      hasError,
    ],
  );

  return useMemo(
    () => ({
      // Main handlers and values (flat)
      value: value as BitPathValue<TForm, P>,
      displayValue,
      setValue,
      setBlur,
      onChange,
      onBlur,
      // Props helper
      props,
      // Metadata (grouped)
      meta,
    }),
    [value, displayValue, setValue, setBlur, onChange, onBlur, props, meta],
  );
}
