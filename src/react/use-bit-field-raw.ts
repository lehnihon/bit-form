import { useCallback } from "react";
import { useBitFieldBase } from "./use-bit-field-base";
import { BitPath, BitPathValue } from "../core";
import { isBitFieldInputEventObject } from "../core/mask/field-binding";
import { deriveFieldMeta } from "../core/utils/field-meta";
import type { BitFieldInputEvent, UseBitFieldRawResult } from "./types";

export function useBitFieldRaw<
  TForm extends object = any,
  P extends BitPath<TForm> = BitPath<TForm>,
>(path: P): UseBitFieldRawResult<TForm, P> {
  const { fieldState, setValue, setBlur } = useBitFieldBase<
    BitPathValue<TForm, P>,
    TForm,
    P
  >(path);

  const metaState = deriveFieldMeta(fieldState);

  const onChange = useCallback(
    (event: BitFieldInputEvent) => {
      const value = isBitFieldInputEventObject(event)
        ? event.target?.value
        : event;
      setValue(value as BitPathValue<TForm, P>);
    },
    [setValue],
  );

  const onBlur = useCallback(() => {
    setBlur();
  }, [setBlur]);

  return {
    value: fieldState.value as BitPathValue<TForm, P>,
    setValue,
    setBlur,
    onChange,
    onBlur,
    props: {
      value: fieldState.value as BitPathValue<TForm, P>,
      onChange,
      onBlur,
    },
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
