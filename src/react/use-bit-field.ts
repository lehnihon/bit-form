import { useMemo, useCallback } from "react";
import { useBitFieldBase } from "./use-bit-field-base";
import { BitPath, BitPathValue } from "../core";
import { createFrameworkMaskedFieldBinding } from "../core/bindings/field-binding";
import { isBitFieldInputEventObject } from "../core/mask/field-binding";
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
  const { fieldState, setBlur, store } = useBitFieldBase<
    BitPathValue<TForm, P>,
    TForm,
    P
  >(path);

  const { fieldController } = useMemo(() => {
    return createFrameworkMaskedFieldBinding(store, path);
  }, [store.config.masks, store.config.fields, path]);

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
