import { useMemo, useCallback } from "react";
import { useBitFieldBase } from "../react/use-bit-field-base";
import { BitFieldOptions, BitPath, BitPathValue } from "../core";

export function useBitField<
  TForm extends object = any,
  P extends BitPath<TForm> = BitPath<TForm>,
>(path: P, options?: BitFieldOptions) {
  const { fieldState, setValue, setBlur, store } = useBitFieldBase<
    BitPathValue<TForm, P>,
    TForm,
    P
  >(path);

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

  const handleChange = useCallback(
    (text: string) => {
      if (!resolvedMask) {
        setValue(text as any);
        return;
      }

      setValue(resolvedMask.parse(String(text ?? "")) as any);
    },
    [resolvedMask, setValue],
  );

  const { isHidden, isRequired, value, error, touched } = fieldState;

  return {
    value: value as BitPathValue<TForm, P>,
    displayValue,
    error: touched ? error : undefined,
    touched: touched,
    invalid: !!(touched && error),
    isValidating: store.isFieldValidating(path),
    isDirty: store.isFieldDirty(path),
    isHidden,
    isRequired,
    setValue,
    setBlur,
    props: {
      value: displayValue,
      onChangeText: handleChange,
      onBlur: setBlur,
    },
  };
}
