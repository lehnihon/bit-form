import type { BitPath, BitPathValue } from "../core";

/**
 * Metadata describing the current state of a form field (React Native).
 */
export interface UseBitFieldNativeMeta {
  error: string | undefined;
  touched: boolean;
  invalid: boolean;
  isValidating: boolean;
  isDirty: boolean;
  isHidden: boolean;
  isRequired: boolean;
  hasError: boolean;
}

/**
 * Props that can be spread onto a React Native input component.
 */
export interface UseBitFieldNativeBindProps {
  value: string;
  onChangeText: (value: string) => void;
  onBlur: () => void;
}

/**
 * Result from useBitField hook in React Native.
 * Provides field state, value, handlers, and metadata for native mobile development.
 */
export interface UseBitFieldNativeResult<
  TForm extends object = any,
  P extends BitPath<TForm> = BitPath<TForm>,
> {
  value: BitPathValue<TForm, P>;
  displayValue: string;
  setValue: (val: any) => void;
  setBlur: () => void;
  onChangeText: (text: string) => void;
  onBlur: () => void;
  meta: UseBitFieldNativeMeta;
  props: UseBitFieldNativeBindProps;
}
