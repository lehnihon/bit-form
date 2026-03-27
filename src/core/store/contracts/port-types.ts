import type {
  BitAfterSubmitEvent,
  BitAfterValidateEvent,
  BitBeforeSubmitEvent,
  BitBeforeValidateEvent,
  BitErrors,
  BitFieldChangeEvent,
  BitFieldDefinition,
  BitState,
  BitTransformFn,
} from "./types";
import type { BitStoreOperation } from "../engines/operation-engine";
import type { BitFrameworkConfig } from "./public/store-api-types";
import type { BitValidationOptions } from "./public/meta-types";

export interface BitDependencyUpdateDiff {
  affectedFields: string[];
  visibilityChanged: string[];
  requiredChanged: string[];
}

export interface BitValidationStatePort<T extends object> {
  getState: () => BitState<T>;
  dispatch: (operation: BitStoreOperation<T>) => void;
  config: BitFrameworkConfig<T>;
}

export interface BitValidationFieldPort<T extends object> {
  getFieldConfig: (path: string) => BitFieldDefinition<T> | undefined;
  forEachFieldConfig: (
    callback: (config: BitFieldDefinition<T>, path: string) => void,
  ) => void;
  getScopeFields: (scopeName: string) => string[];
  getRequiredErrors: (values: T) => BitErrors<T>;
  getHiddenFields: () => ReadonlySet<string>;
}

export interface BitValidationEffectsPort<T extends object> {
  setError: (path: string, message: string | undefined) => void;
  validate: (opts: BitValidationOptions) => Promise<boolean>;
  emitBeforeValidate: (event: BitBeforeValidateEvent<T>) => Promise<void>;
  emitAfterValidate: (event: BitAfterValidateEvent<T>) => Promise<void>;
}

export type BitValidationPipelinePort<T extends object> =
  BitValidationStatePort<T> &
    BitValidationFieldPort<T> &
    Pick<
      BitValidationEffectsPort<T>,
      "emitBeforeValidate" | "emitAfterValidate"
    >;

export type BitValidationManagerPort<T extends object> =
  BitValidationStatePort<T> &
    BitValidationFieldPort<T> &
    BitValidationEffectsPort<T>;

export interface BitValidationTriggerOptions {
  forceDebounce?: boolean;
}

export interface BitLifecycleFieldUpdatePort<T extends object> {
  getState: () => BitState<T>;
  dispatch: (operation: BitStoreOperation<T>) => void;
  config: BitFrameworkConfig<T>;
  getFieldConfig: (path: string) => BitFieldDefinition<T> | undefined;
  updateDependencies: (
    changedPath: string,
    currentValues: T,
    newValues: T,
  ) => BitDependencyUpdateDiff;
  hasDependentFields: (path: string) => boolean;
  isFieldHidden: (path: string) => boolean;
  clearFieldValidation: (path: string) => void;
  triggerValidation: (
    scopeFields?: string[],
    options?: BitValidationTriggerOptions,
  ) => void;
  handleFieldAsyncValidation: (path: string, value: unknown) => void;
  updateDirtyForPath: (
    path: string,
    nextValues: T,
    baselineValues: T,
  ) => boolean;
  getBaselineValues: () => T;
  emitFieldChange: (event: BitFieldChangeEvent<T>) => void;
}

export interface BitLifecycleValuesPort<T extends object> {
  getState: () => BitState<T>;
  dispatch: (operation: BitStoreOperation<T>) => void;
  internalSaveSnapshot: () => void;
  evaluateAllDependencies: (values: T) => void;
  cancelAllValidations: () => void;
  validateNow: (options?: BitValidationOptions) => Promise<boolean>;
  rebuildDirtyState: (nextValues: T, baselineValues: T) => boolean;
  clearDirtyState: () => void;
  getBaselineValues: () => T;
  setBaselineValues: (values: T) => void;
  resetHistory: (initialValues: T) => void;
  emitFieldChange: (event: BitFieldChangeEvent<T>) => void;
  triggerValidation: (
    scopeFields?: string[],
    options?: BitValidationTriggerOptions,
  ) => void;
}

export interface BitLifecycleSubmitPort<T extends object> {
  getState: () => BitState<T>;
  dispatch: (operation: BitStoreOperation<T>) => void;
  batchStateUpdates<TResult>(callback: () => TResult): TResult;
  config: BitFrameworkConfig<T>;
  getTransformEntries: () => [string, BitTransformFn<T>][];
  getHiddenFields: () => ReadonlySet<string>;
  cancelAllValidations: () => void;
  validateNow: (options?: BitValidationOptions) => Promise<boolean>;
  hasValidationsInProgress: (scopeFields?: string[]) => boolean;
  buildDirtyValues: (values: T) => Partial<T>;
  emitBeforeSubmit: (event: BitBeforeSubmitEvent<T>) => Promise<void>;
  emitAfterSubmit: (event: BitAfterSubmitEvent<T>) => Promise<void>;
  emitOperationalError: (event: {
    source: "submit";
    error: unknown;
    payload?: unknown;
  }) => Promise<void>;

  onUnhandledError?: (error: unknown, source: "submit") => void;
}

export interface BitLifecyclePorts<T extends object> {
  fieldUpdate: BitLifecycleFieldUpdatePort<T>;
  values: BitLifecycleValuesPort<T>;
  submit: BitLifecycleSubmitPort<T>;
}
