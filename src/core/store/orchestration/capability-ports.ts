import type {
  BitFieldChangeMeta,
  BitFieldDefinition,
  BitState,
  BitTransformFn,
} from "../contracts/types";
import type { BitFrameworkConfig } from "../contracts/public/store-api-types";
import type { BitValidationOptions } from "../contracts/public/meta-types";
import type {
  BitValidationTriggerOptions,
  BitLifecycleFieldUpdatePort,
  BitLifecyclePorts,
  BitLifecycleSubmitPort,
  BitLifecycleValuesPort,
  BitValidationManagerPort,
} from "../contracts/port-types";
import type { BitArrayStorePort } from "../managers/features/array-manager";
import type { BitStoreOperation } from "../engines/operation-engine";
import { BitFieldRegistry } from "../registry/field-registry";
import { BitDirtyManager } from "../managers/core/dirty-manager";
import type { BitStoreEffectEngine } from "../engines/effect-engine";

// Interfaces locais usadas pelas deps do lifecycle port
interface BitValidationAccess<T extends object> {
  clear(path: string): void;
  trigger(scopeFields?: string[], options?: BitValidationTriggerOptions): void;
  handleAsync(path: string, value: unknown): void;
  cancelAll(): void;
  validate(options?: BitValidationOptions): Promise<boolean>;
  hasValidationsInProgress(scopeFields?: string[]): boolean;
}

interface BitHistoryAccess<T extends object> {
  reset(initialValues: T): void;
}

// ---------------------------------------------------------------------------
// Validation port
// ---------------------------------------------------------------------------

export interface BitValidationPortDeps<T extends object> {
  config: BitFrameworkConfig<T>;
  fieldRegistry: BitFieldRegistry<T>;
  getState(): BitState<T>;
  dispatch(operation: BitStoreOperation<T>): void;
  setError(path: string, message: string | undefined): void;
  validate(options?: BitValidationOptions): Promise<boolean>;
  getFieldConfig(path: string): BitFieldDefinition<T> | undefined;
  getScopeFields(scopeName: string): string[];
  getEffects(): BitStoreEffectEngine<T>;
}

export function createValidationPort<T extends object>(
  deps: BitValidationPortDeps<T>,
): BitValidationManagerPort<T> {
  return {
    getState: deps.getState,
    dispatch: deps.dispatch,
    setError: deps.setError,
    validate: deps.validate,
    getFieldConfig: deps.getFieldConfig,
    forEachFieldConfig: (callback) =>
      deps.fieldRegistry.forEachFieldConfig((config, path) =>
        callback(config, path),
      ),
    getScopeFields: deps.getScopeFields,
    config: deps.config,
    getRequiredErrors: (values) => deps.fieldRegistry.getRequiredErrors(values),
    getHiddenFields: () => deps.fieldRegistry.getHiddenFields(),
    emitBeforeValidate: (event) => deps.getEffects().beforeValidate(event),
    emitAfterValidate: (event) => deps.getEffects().afterValidate(event),
  };
}

// ---------------------------------------------------------------------------
// Lifecycle port
// ---------------------------------------------------------------------------

export interface BitLifecyclePortDeps<T extends object> {
  config: BitFrameworkConfig<T>;
  fieldRegistry: BitFieldRegistry<T>;
  dirtyManager: BitDirtyManager<T>;
  getState(): BitState<T>;
  dispatch(operation: BitStoreOperation<T>): void;
  saveHistorySnapshot(): void;
  runStateBatch<TResult>(callback: () => TResult): TResult;
  getTransformEntries(): [string, BitTransformFn<T>][];
  getBaselineValues(): T;
  setBaselineValues(values: T): void;
  getValidation(): BitValidationAccess<T>;
  getHistory(): BitHistoryAccess<T>;
  getEffects(): BitStoreEffectEngine<T>;
}

export function createLifecyclePort<T extends object>(
  deps: BitLifecyclePortDeps<T>,
): BitLifecyclePorts<T> {
  const fieldUpdate: BitLifecycleFieldUpdatePort<T> = {
    getState: deps.getState,
    dispatch: deps.dispatch,
    config: deps.config,
    getFieldConfig: (path) => deps.fieldRegistry.getFieldConfig(path),
    updateDependencies: (changedPath, currentValues, newValues) =>
      deps.fieldRegistry.updateDependencies(
        changedPath,
        currentValues,
        newValues,
      ),
    hasDependentFields: (path) => deps.fieldRegistry.hasDependents(path),
    isFieldHidden: (path) => deps.fieldRegistry.isHidden(path),
    clearFieldValidation: (path) => deps.getValidation().clear(path),
    triggerValidation: (scopeFields, options) =>
      deps.getValidation().trigger(scopeFields, options),
    handleFieldAsyncValidation: (path, value) =>
      deps.getValidation().handleAsync(path, value),
    updateDirtyForPath: (path, nextValues, baselineValues) =>
      deps.dirtyManager.updateForPath(path, nextValues, baselineValues),
    getBaselineValues: deps.getBaselineValues,
    emitFieldChange: (event) => deps.getEffects().onFieldChange(event),
  };

  const values: BitLifecycleValuesPort<T> = {
    getState: deps.getState,
    dispatch: deps.dispatch,
    internalSaveSnapshot: deps.saveHistorySnapshot,
    evaluateAllDependencies: (newValues) => deps.fieldRegistry.evaluateAll(newValues),
    cancelAllValidations: () => deps.getValidation().cancelAll(),
    validateNow: (options) => deps.getValidation().validate(options),
    rebuildDirtyState: (nextValues, baselineValues) =>
      deps.dirtyManager.rebuild(nextValues, baselineValues),
    clearDirtyState: deps.dirtyManager.clear.bind(deps.dirtyManager),
    getBaselineValues: deps.getBaselineValues,
    setBaselineValues: deps.setBaselineValues,
    resetHistory: (initialValues) => deps.getHistory().reset(initialValues),
    emitFieldChange: (event) => deps.getEffects().onFieldChange(event),
    triggerValidation: (scopeFields, options) =>
      deps.getValidation().trigger(scopeFields, options),
  };

  const submit: BitLifecycleSubmitPort<T> = {
    getState: deps.getState,
    dispatch: deps.dispatch,
    batchStateUpdates: deps.runStateBatch,
    config: deps.config,
    getTransformEntries: deps.getTransformEntries,
    getHiddenFields: () => deps.fieldRegistry.getHiddenFields(),
    cancelAllValidations: () => deps.getValidation().cancelAll(),
    validateNow: (options) => deps.getValidation().validate(options),
    hasValidationsInProgress: (scopeFields) =>
      deps.getValidation().hasValidationsInProgress(scopeFields),
    buildDirtyValues: (values) => deps.dirtyManager.buildDirtyValues(values),
    emitBeforeSubmit: (event) => deps.getEffects().beforeSubmit(event),
    emitAfterSubmit: (event) => deps.getEffects().afterSubmit(event),
    emitOperationalError: (event) =>
      deps.getEffects().reportOperationalError(event),
  };

  return {
    fieldUpdate,
    values,
    submit,
  };
}

// ---------------------------------------------------------------------------
// Array port
// ---------------------------------------------------------------------------

export interface BitArrayPortDeps<T extends object> {
  getState(): BitState<T>;
  dispatch(operation: BitStoreOperation<T>): void;
  setFieldWithMeta(
    path: string,
    value: unknown,
    meta: BitFieldChangeMeta,
  ): void;
  unregisterPrefix(prefix: string): void;
  triggerValidation(
    scopeFields?: string[],
    options?: BitValidationTriggerOptions,
  ): void;
  dirtyManager: BitDirtyManager<T>;
  getBaselineValues(): T;
  getEffects(): BitStoreEffectEngine<T>;
  saveHistorySnapshot(): void;
}

export function createArrayPort<T extends object>(
  deps: BitArrayPortDeps<T>,
): BitArrayStorePort<T> {
  return {
    getState: deps.getState,
    setFieldWithMeta: deps.setFieldWithMeta,
    emitFieldChange: (event) => deps.getEffects().onFieldChange(event),
    dispatch: deps.dispatch,
    internalSaveSnapshot: deps.saveHistorySnapshot,
    unregisterPrefix: deps.unregisterPrefix,
    triggerValidation: (scopeFields) => deps.triggerValidation(scopeFields),
    updateDirtyForPath: (path, nextValues, baselineValues) =>
      deps.dirtyManager.updateForPath(path, nextValues, baselineValues),
    getBaselineValues: deps.getBaselineValues,
  };
}
