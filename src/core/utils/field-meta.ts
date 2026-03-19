import type { BitFieldState } from "../store/contracts/types";

export interface BitDerivedFieldMeta {
  error: string | undefined;
  touched: boolean;
  invalid: boolean;
  isValidating: boolean;
  isDirty: boolean;
  isHidden: boolean;
  isRequired: boolean;
  hasError: boolean;
}

export function deriveFieldMeta<T extends object, TValue>(
  state: Readonly<BitFieldState<T, TValue>>,
): BitDerivedFieldMeta {
  const error = state.touched ? state.error : undefined;
  const hasError = !!state.error;

  return {
    error,
    touched: state.touched,
    invalid: !!(state.touched && state.error),
    isValidating: state.isValidating,
    isDirty: state.isDirty,
    isHidden: state.isHidden,
    isRequired: state.isRequired,
    hasError,
  };
}
