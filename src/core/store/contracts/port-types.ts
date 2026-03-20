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
import type { BitFrameworkConfig, BitValidationOptions } from "./public-types";

export interface BitValidationStorePort<T extends object> {
  getState: () => BitState<T>;
  dispatch: (operation: BitStoreOperation<T>) => void;
  setError: (path: string, message: string | undefined) => void;
  validate: (opts: BitValidationOptions) => Promise<boolean>;
  getFieldConfig: (path: string) => BitFieldDefinition<T> | undefined;
  forEachFieldConfig: (
    callback: (config: BitFieldDefinition<T>, path: string) => void,
  ) => void;
  getScopeFields: (scopeName: string) => string[];
  config: BitFrameworkConfig<T>;
  getRequiredErrors: (values: T) => BitErrors<T>;
  getHiddenFields: () => ReadonlySet<string>;
  emitBeforeValidate: (event: BitBeforeValidateEvent<T>) => Promise<void>;
  emitAfterValidate: (event: BitAfterValidateEvent<T>) => Promise<void>;
}

export interface BitValidationTriggerOptions {
  forceDebounce?: boolean;
}

interface BitLifecycleStatePort<T extends object> {
  getState: () => BitState<T>;
  dispatch: (operation: BitStoreOperation<T>) => void;
  internalSaveSnapshot: () => void;
  batchStateUpdates<TResult>(callback: () => TResult): TResult;
  config: BitFrameworkConfig<T>;
}

interface BitLifecycleDependencyPort<T extends object> {
  getFieldConfig: (path: string) => BitFieldDefinition<T> | undefined;
  getTransformEntries: () => [string, BitTransformFn<T>][];
  updateDependencies: (changedPath: string, newValues: T) => string[];
  hasDependentFields: (path: string) => boolean;
  isFieldHidden: (path: string) => boolean;
  evaluateAllDependencies: (values: T) => void;
  getHiddenFields: () => ReadonlySet<string>;
}

interface BitLifecycleValidationPort<T extends object> {
  clearFieldValidation: (path: string) => void;
  triggerValidation: (
    scopeFields?: string[],
    options?: BitValidationTriggerOptions,
  ) => void;
  handleFieldAsyncValidation: (path: string, value: any) => void;
  cancelAllValidations: () => void;
  validateNow: (options?: BitValidationOptions) => Promise<boolean>;
  hasValidationsInProgress: (scopeFields?: string[]) => boolean;
}

interface BitLifecycleDirtyPort<T extends object> {
  updateDirtyForPath: (
    path: string,
    nextValues: T,
    baselineValues: T,
  ) => boolean;
  rebuildDirtyState: (nextValues: T, baselineValues: T) => boolean;
  clearDirtyState: () => void;
  buildDirtyValues: (values: T) => Partial<T>;
  getInitialValues: () => T;
  setInitialValues: (values: T) => void;
  resetHistory: (initialValues: T) => void;
}

interface BitLifecycleEffectsPort<T extends object> {
  emitFieldChange: (event: BitFieldChangeEvent<T>) => void;
  emitBeforeSubmit: (event: BitBeforeSubmitEvent<T>) => Promise<void>;
  emitAfterSubmit: (event: BitAfterSubmitEvent<T>) => Promise<void>;
  emitOperationalError: (event: {
    source: "submit";
    error: unknown;
    payload?: unknown;
  }) => Promise<void>;
}

export type BitLifecycleStorePort<T extends object> = BitLifecycleStatePort<T> &
  BitLifecycleDependencyPort<T> &
  BitLifecycleValidationPort<T> &
  BitLifecycleDirtyPort<T> &
  BitLifecycleEffectsPort<T>;
