import { useMemo, useCallback } from "react";
import { useBitFieldBase } from "./use-bit-field-base";
import { BitMask } from "../core/mask/types";

export interface UseBitFieldOptions {
  mask?: BitMask | string;
  unmask?: boolean;
}

export function useBitField<T = any>(
  path: string,
  options?: UseBitFieldOptions,
) {
  const {
    fieldState,
    setValue: rawSetValue,
    setBlur,
    store,
  } = useBitFieldBase<T>(path);

  // 1. Resolução da máscara
  const resolvedMask = useMemo(() => {
    const maskOption = options?.mask;
    if (!maskOption) return undefined;
    return typeof maskOption === "string"
      ? store.masks[maskOption]
      : maskOption;
  }, [options?.mask, store.masks]);

  const shouldUnmask = options?.unmask ?? store.defaultUnmask ?? true;

  // 2. Cálculo do valor de exibição (sempre string para o input)
  const displayValue = useMemo(() => {
    const val = fieldState.value;
    if (val === undefined || val === null || val === "") return "";

    if (resolvedMask) {
      // Se unmask=true (dado limpo na store), formatamos para exibir
      // Se unmask=false (dado formatado na store), apenas garantimos que é string
      return shouldUnmask ? resolvedMask.format(val) : String(val);
    }
    return String(val);
  }, [fieldState.value, resolvedMask, shouldUnmask]);

  // 3. Função de atualização que respeita a máscara
  const setValue = useCallback(
    (val: any) => {
      if (!resolvedMask) {
        rawSetValue(val);
        return;
      }

      // Garante que o valor passado para o parse/format seja string
      const stringVal = String(val ?? "");

      if (shouldUnmask) {
        rawSetValue(resolvedMask.parse(stringVal) as any);
      } else {
        rawSetValue(resolvedMask.format(stringVal) as any);
      }
    },
    [resolvedMask, shouldUnmask, rawSetValue],
  );

  return {
    value: fieldState.value as T,
    displayValue, // AGORA DISPONÍVEL NA RAIZ (Resolve o erro de TS)
    error: fieldState.touched ? fieldState.error : undefined,
    touched: fieldState.touched,
    invalid: !!(fieldState.touched && fieldState.error),
    setValue, // Agora esta função aplica a máscara!
    setBlur,
    props: {
      value: displayValue,
      onChange: (e: any) => {
        const val = e?.target ? e.target.value : e;
        setValue(val);
      },
      onBlur: setBlur,
    },
  };
}
