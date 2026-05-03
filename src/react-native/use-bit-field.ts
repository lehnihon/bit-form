import { useMemo, useCallback } from "react";
import { useBitFieldBase } from "../react/use-bit-field-base";
import {
  BitPath,
  BitPathValue,
  createFrameworkMaskedFieldBinding,
  deriveFieldMeta,
} from "../core";
import type { UseBitFieldNativeResult } from "./types";

export function useBitField<
  TForm extends object = any,
  P extends BitPath<TForm> = BitPath<TForm>,
>(path: P): UseBitFieldNativeResult<TForm, P> {
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

  const handleChange = useCallback(
    (text: string) => fieldController.setValue(text),
    [fieldController],
  );

  const setValue = useCallback(
    (val: BitPathValue<TForm, P> | string | number | null | undefined) =>
      fieldController.setValue(val),
    [fieldController],
  );

  const { value } = fieldState;
  const metaState = deriveFieldMeta(fieldState);

  const onBlur = useCallback(() => {
    setBlur();
  }, [setBlur]);

  const meta = useMemo(
    () => ({
      error: metaState.error,
      touched: metaState.touched,
      invalid: metaState.invalid,
      isValidating: metaState.isValidating,
      isDirty: metaState.isDirty,
      isHidden: metaState.isHidden,
      isRequired: metaState.isRequired,
      hasError: metaState.hasError,
    }),
    [
      metaState.error,
      metaState.touched,
      metaState.invalid,
      metaState.isValidating,
      metaState.isDirty,
      metaState.isHidden,
      metaState.isRequired,
      metaState.hasError,
    ],
  );

  const props = useMemo(
    () => ({
      value: displayValue,
      onChangeText: handleChange,
      onBlur,
    }),
    [displayValue, handleChange, onBlur],
  );

  return useMemo(
    () => ({
      value: value as BitPathValue<TForm, P>,
      displayValue,
      setValue,
      setBlur,
      onChangeText: handleChange,
      onBlur,
      meta,
      props,
    }),
    [value, displayValue, setValue, setBlur, handleChange, onBlur, meta, props],
  );
}
