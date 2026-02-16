import { BitMask } from "../mask/types";

export type BitErrors<T> = { [key: string]: string | undefined };
export type BitTouched<T> = { [key: string]: boolean | undefined };
export type BitComputedFn<T> = (values: T) => any;
export type BitTransformFn<T> = (value: any, allValues: T) => any;

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
  options?: { scopeFields?: string[] },
) => Promise<BitErrors<T>> | BitErrors<T>;

export interface BitFieldConfig<T extends object = any> {
  dependsOn?: string[];
  showIf?: (values: T) => boolean;
  requiredIf?: (values: T) => boolean;
}

export interface BitConfig<T extends object = any> {
  initialValues?: T;
  resolver?: ValidatorFn<T>;
  computed?: Record<string, BitComputedFn<T>>;
  scopes?: Record<string, string[]>;
  transform?: Partial<Record<string, BitTransformFn<T>>>;
  validationDelay?: number;
  defaultUnmask?: boolean;
  masks?: Record<string, BitMask>;
  enableHistory?: boolean;
  fields?: Record<string, BitFieldConfig<T>>;
}

export interface BitFieldOptions {
  mask?: BitMask | string;
  unmask?: boolean;
}
