import {
  BitAfterSubmitEvent,
  BitAfterValidateEvent,
  BitBeforeSubmitEvent,
  BitBeforeValidateEvent,
  BitErrors,
  BitFieldChangeEvent,
  BitFieldChangeMeta,
  BitFieldDefinition,
  BitState,
  BitTransformFn,
} from "./types";
import type { BitFrameworkConfig } from "./public-types";

export interface BitResolvedConfig<
  T extends object = any,
> extends BitFrameworkConfig<T> {}

export interface BitLifecycleAdapter<T extends object> {
  getState: () => BitState<T>;
  internalUpdateState: (partial: Partial<BitState<T>>) => void;
  internalSaveSnapshot: () => void;
  getTransformEntries: () => [string, BitTransformFn<T>][];
  config: BitResolvedConfig<T>;

  updateDependencies: (changedPath: string, newValues: T) => string[];
  isFieldHidden: (path: string) => boolean;
  evaluateAllDependencies: (values: T) => void;
  getHiddenFields: () => string[];

  clearFieldValidation: (path: string) => void;
  triggerValidation: (scopeFields?: string[]) => void;
  handleFieldAsyncValidation: (path: string, value: any) => void;
  cancelAllValidations: () => void;
  validateNow: (options?: {
    scope?: string;
    scopeFields?: string[];
  }) => Promise<boolean>;
  hasValidationsInProgress: (scopeFields?: string[]) => boolean;

  updateDirtyForPath: (
    path: string,
    nextValues: T,
    baselineValues: T,
  ) => boolean;
  rebuildDirtyState: (nextValues: T, baselineValues: T) => boolean;
  clearDirtyState: () => void;
  buildDirtyValues: (values: T) => Partial<T>;

  resetHistory: (initialValues: T) => void;

  emitFieldChange: (event: BitFieldChangeEvent<T>) => void;
  emitBeforeSubmit: (event: BitBeforeSubmitEvent<T>) => Promise<void>;
  emitAfterSubmit: (event: BitAfterSubmitEvent<T>) => Promise<void>;
  emitOperationalError: (event: {
    source: "submit";
    error: unknown;
    payload?: unknown;
  }) => Promise<void>;
}

export interface BitStoreAdapter<T extends object = any> {
  getState: () => BitState<T>;
  getConfig(): BitResolvedConfig<T>;
  setField(path: string, value: any): void;
  setFieldWithMeta(path: string, value: any, meta: BitFieldChangeMeta): void;
  emitFieldChange(event: BitFieldChangeEvent<T>): void;
  internalUpdateState(partialState: any): void;
  internalSaveSnapshot(): void;
  unregisterPrefix?: (prefix: string) => void;
  validate?: () => Promise<boolean>;
  triggerValidation?: (scopeFields?: string[]) => void;
  updateDirtyForPath: (
    path: string,
    nextValues: T,
    baselineValues: T,
  ) => boolean;
}

export interface BitValidationAdapter<T extends object> {
  getState: () => BitState<T>;
  internalUpdateState: (partial: Partial<BitState<T>>) => void;
  setError: (path: string, message: string | undefined) => void;
  validate?: (opts: { scopeFields?: string[] }) => Promise<boolean>;
  getFieldConfig: (path: string) => BitFieldDefinition<T> | undefined;
  getScopeFields: (scopeName: string) => string[];
  config: BitResolvedConfig<T>;
  getRequiredErrors: (values: T) => BitErrors<T>;
  getHiddenFields: () => string[];
  emitBeforeValidate: (event: BitBeforeValidateEvent<T>) => Promise<void>;
  emitAfterValidate: (event: BitAfterValidateEvent<T>) => Promise<void>;
}
