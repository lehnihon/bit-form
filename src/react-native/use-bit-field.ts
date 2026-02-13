import { useBitFieldBase } from "../react/use-bit-field-base";

export function useBitField<T = any>(path: string) {
  const { fieldState, setValue, setBlur } = useBitFieldBase<T>(path);

  return {
    value: fieldState.value as T,
    error: fieldState.touched ? fieldState.error : undefined,
    touched: fieldState.touched,
    invalid: !!(fieldState.touched && fieldState.error),
    setValue,
    setBlur,
    props: {
      value: fieldState.value != null ? String(fieldState.value) : "",
      onChangeText: setValue,
      onBlur: setBlur,
    },
  };
}
