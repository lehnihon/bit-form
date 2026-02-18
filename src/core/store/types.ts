import { BitMask } from "../mask/types";
import { BitDependencyManager } from "./dependency-manager";
import { BitHistoryManager } from "./history-manager";
import { BitValidationManager } from "./validation-manager";

export type BitErrors<T> = { [key: string]: string | undefined };
export type BitTouched<T> = { [key: string]: boolean | undefined };
export type BitComputedFn<T> = (values: T) => any;
export type BitTransformFn<T> = (value: any, allValues: T) => any;

export interface BitState<T> {
  values: T;
  errors: BitErrors<T>;
  touched: BitTouched<T>;
  isValidating: Record<string, boolean>;
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
  asyncValidate?: (value: any, values: T) => Promise<string | null | undefined>;
  asyncValidateDelay?: number;
}

export interface BitConfig<T extends object = any> {
  name?: string;
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

export type BitResolvedConfig<T extends object> = BitConfig<T> & {
  initialValues: T;
};

export interface BitFieldOptions {
  mask?: BitMask | string;
  unmask?: boolean;
}

export interface BitLifecycleAdapter<T extends object> {
  getState: () => BitState<T>;
  internalUpdateState: (partial: Partial<BitState<T>>) => void;
  internalSaveSnapshot: () => void;
  config: BitResolvedConfig<T>;
  deps: BitDependencyManager<T>;
  validator: BitValidationManager<T>;
  history: BitHistoryManager<T>;
}

export interface BitStoreAdapter<T extends object = any> {
  getState: () => BitState<T>;
  getConfig(): BitResolvedConfig<T>;
  setField(path: string, value: any): void;
  internalUpdateState(partialState: any): void;
  internalSaveSnapshot(): void;
  unregisterPrefix?: (prefix: string) => void;
  validate?: () => Promise<boolean>;
}

export interface BitValidationAdapter<T extends object> {
  getState: () => BitState<T>;
  internalUpdateState: (partial: Partial<BitState<T>>) => void;
  setError: (path: string, message: string | undefined) => void;
  config: BitResolvedConfig<T>;
  deps: BitDependencyManager<T>;
}
