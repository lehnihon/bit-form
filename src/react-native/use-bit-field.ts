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
    (val: any) => fieldController.setValue(val),
    [fieldController],
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
