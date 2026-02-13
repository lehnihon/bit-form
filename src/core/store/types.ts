import { BitMask } from "../mask/types";

export type BitErrors<T> = { [key: string]: string | undefined };
export type BitTouched<T> = { [key: string]: boolean | undefined };

export interface BitState<T> {
  values: T;
  errors: BitErrors<T>;
  touched: BitTouched<T>;
  isValid: boolean;
  isSubmitting: boolean;
  isDirty: boolean;
}

export type ValidatorFn<T> = (
  values: T,
) => Promise<BitErrors<T>> | BitErrors<T>;

export interface BitConfig<T> {
  initialValues: T;
  resolver?: ValidatorFn<T>;
  transform?: Partial<Record<string, (value: any) => any>>;
  validationDelay?: number;
  defaultUnmask?: boolean;
  masks?: Record<string, BitMask>;
}
