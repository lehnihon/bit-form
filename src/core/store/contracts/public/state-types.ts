import type { BitPath } from "./path-types";

export type DeepPartial<T> = T extends object
  ? { [P in keyof T]?: DeepPartial<T[P]> }
  : T;

export type BitErrors<T extends object> = Partial<
  Record<BitPath<T>, string | undefined>
>;

export type BitTouched<T extends object> = Partial<
  Record<BitPath<T>, boolean | undefined>
>;

export interface BitPersistMetadata {
  isSaving: boolean;
  isRestoring: boolean;
  error: Error | null;
}

export interface BitState<T extends object> {
  values: T;
  errors: BitErrors<T>;
  touched: BitTouched<T>;
  isValidating: Record<string, boolean>;
  persist: BitPersistMetadata;
  isValid: boolean;
  isSubmitting: boolean;
  isDirty: boolean;
}

export interface BitFieldState<
  _T extends object = Record<string, unknown>,
  TValue = unknown,
> {
  value: TValue;
  error: string | undefined;
  touched: boolean;
  isHidden: boolean;
  isRequired: boolean;
  isDirty: boolean;
  isValidating: boolean;
}
