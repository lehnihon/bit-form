import {
  BitErrors,
  BitFieldDefinition,
  BitPath,
  BitPathValue,
  BitComputedFn,
  BitTransformFn,
  BitConfig,
  DevToolsOptions,
  ScopeStatus,
  ValidatorFn,
  BitState,
} from "./types";
import { BitMask } from "../mask/types";

export interface BitFrameworkConfig<
  T extends object = any,
> extends BitConfig<T> {
  initialValues: T;
  resolver?: ValidatorFn<T>;
  validationDelay: number;
  enableHistory: boolean;
  historyLimit: number;
  computed?: Record<string, BitComputedFn<T>>;
  transform?: Partial<Record<string, BitTransformFn<T>>>;
  scopes?: Record<string, string[]>;
  masks?: Record<string, BitMask>;
  fields?: Record<string, BitFieldDefinition<T>>;
  devTools?: boolean | DevToolsOptions;
}

export interface BitPublicStore<T extends object = any> {
  getConfig(): Readonly<BitFrameworkConfig<T>>;
  getState(): Readonly<BitState<T>>;
  subscribe(listener: () => void): () => void;

  setField<P extends BitPath<T>>(path: P, value: BitPathValue<T, P>): void;
  blurField<P extends BitPath<T>>(path: P): void;
  setValues(values: T): void;

  setError(path: string, message: string | undefined): void;
  setErrors(errors: BitErrors<T>): void;
  setServerErrors(serverErrors: Record<string, string[] | string>): void;

  validate(options?: {
    scope?: string;
    scopeFields?: string[];
  }): Promise<boolean>;

  reset(): void;

  submit(
    onSuccess: (values: T, dirtyValues?: Partial<T>) => void | Promise<void>,
  ): Promise<void>;

  registerMask(name: string, mask: BitMask): void;
  getDirtyValues(): Partial<T>;

  cleanup(): void;
}

export interface BitFrameworkStore<
  T extends object = any,
> extends BitPublicStore<T> {
  config: BitFrameworkConfig<T>;

  registerField(path: string, config: BitFieldDefinition<T>): void;
  unregisterField(path: string): void;
  unregisterPrefix?(prefix: string): void;

  isHidden(path: any): boolean;
  isRequired(path: any): boolean;
  isFieldDirty(path: string): boolean;
  isFieldValidating(path: string): boolean;

  watch(path: any, callback: (value: any) => void): () => void;

  pushItem(path: any, value: any): void;
  prependItem(path: any, value: any): void;
  insertItem(path: any, index: number, value: any): void;
  removeItem(path: any, index: number): void;
  moveItem(path: any, from: number, to: number): void;
  swapItems(path: any, indexA: number, indexB: number): void;

  getHistoryMetadata(): {
    canUndo: boolean;
    canRedo: boolean;
    historyIndex: number;
    historySize: number;
  };
  undo(): void;
  redo(): void;

  getStepStatus(scopeName: string): ScopeStatus;
  getStepErrors(scopeName: string): Record<string, string>;
  markFieldsTouched(paths: string[]): void;
  hasValidationsInProgress(scopeFields?: string[]): boolean;

  beginFieldValidation(path: string): void;
  endFieldValidation(path: string): void;
  setFieldAsyncError(path: string, message: string): Promise<void>;
  clearFieldAsyncError(path: string): Promise<void>;
}
