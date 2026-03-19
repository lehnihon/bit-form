import type {
  BitFieldChangeMeta,
  BitFieldDefinition,
  BitState,
  BitTransformFn,
} from "../contracts/types";
import type {
  BitFrameworkConfig,
  BitValidationOptions,
} from "../contracts/public-types";
import type { BitValidationTriggerOptions } from "../managers/features/validation-manager";
import type { BitStoreOperation } from "../engines/operation-engine";
import type { BitStoreCapabilityPorts } from "./store-bootstrap";
import { BitFieldRegistry } from "../registry/field-registry";
import { BitDirtyManager } from "../managers/core/dirty-manager";
import type { BitStoreEffectEngine } from "../engines/effect-engine";

interface BitValidationAccess<T extends object> {
  clear(path: string): void;
  trigger(scopeFields?: string[], options?: BitValidationTriggerOptions): void;
  handleAsync(path: string, value: any): void;
  cancelAll(): void;
  validate(options?: BitValidationOptions): Promise<boolean>;
  hasValidationsInProgress(scopeFields?: string[]): boolean;
}

interface BitHistoryAccess<T extends object> {
  reset(initialValues: T): void;
}

interface BitStoreCapabilityPortDeps<T extends object> {
  config: BitFrameworkConfig<T>;
  fieldRegistry: BitFieldRegistry<T>;
  dirtyManager: BitDirtyManager<T>;
  getState(): BitState<T>;
  dispatch(operation: BitStoreOperation<T>): void;
  setError(path: string, message: string | undefined): void;
  validate(options?: BitValidationOptions): Promise<boolean>;
  getFieldConfig(path: string): BitFieldDefinition<T> | undefined;
  getScopeFields(scopeName: string): string[];
  saveHistorySnapshot(): void;
  runStateBatch<TResult>(callback: () => TResult): TResult;
  getTransformEntries(): [string, BitTransformFn<T>][];
  setFieldWithMeta(path: string, value: any, meta: BitFieldChangeMeta): void;
  unregisterPrefix(prefix: string): void;
  triggerValidation(
    scopeFields?: string[],
    options?: BitValidationTriggerOptions,
  ): void;
  getInitialValues(): T;
  setInitialValues(values: T): void;
  getConfig(): Readonly<BitFrameworkConfig<T>>;
  getValidation(): BitValidationAccess<T>;
  getHistory(): BitHistoryAccess<T>;
  getEffects(): BitStoreEffectEngine<T>;
}

export function createCapabilityPorts<T extends object>(
  deps: BitStoreCapabilityPortDeps<T>,
): BitStoreCapabilityPorts<T> {
  return {
    config: deps.config,
    validationPort: {
      getState: () => deps.getState(),
      dispatch: (operation) => deps.dispatch(operation),
      setError: (path, message) => deps.setError(path, message),
      validate: (options) => deps.validate(options),
      getFieldConfig: (path) => deps.getFieldConfig(path),
      getScopeFields: (scopeName) => deps.getScopeFields(scopeName),
      config: deps.config,
      getRequiredErrors: (values) =>
        deps.fieldRegistry.getRequiredErrors(values),
      getHiddenFields: () => deps.fieldRegistry.getHiddenFields(),
      emitBeforeValidate: (event) => deps.getEffects().beforeValidate(event),
      emitAfterValidate: (event) => deps.getEffects().afterValidate(event),
    },
    lifecyclePort: {
      getState: () => deps.getState(),
      dispatch: (operation) => deps.dispatch(operation),
      internalSaveSnapshot: () => deps.saveHistorySnapshot(),
      batchStateUpdates: (callback) => deps.runStateBatch(callback),
      config: deps.config,
      getTransformEntries: () => deps.getTransformEntries(),
      updateDependencies: (changedPath, newValues) =>
        deps.fieldRegistry.updateDependencies(changedPath, newValues),
      isFieldHidden: (path) => deps.fieldRegistry.isHidden(path),
      evaluateAllDependencies: (values) =>
        deps.fieldRegistry.evaluateAll(values),
      getHiddenFields: () => deps.fieldRegistry.getHiddenFields(),
      clearFieldValidation: (path) => deps.getValidation().clear(path),
      triggerValidation: (scopeFields, options) =>
        deps.getValidation().trigger(scopeFields, options),
      handleFieldAsyncValidation: (path, value) =>
        deps.getValidation().handleAsync(path, value),
      cancelAllValidations: () => deps.getValidation().cancelAll(),
      validateNow: (options) => deps.getValidation().validate(options),
      hasValidationsInProgress: (scopeFields) =>
        deps.getValidation().hasValidationsInProgress(scopeFields),
      updateDirtyForPath: (path, nextValues, baselineValues) =>
        deps.dirtyManager.updateForPath(path, nextValues, baselineValues),
      rebuildDirtyState: (nextValues, baselineValues) =>
        deps.dirtyManager.rebuild(nextValues, baselineValues),
      clearDirtyState: () => deps.dirtyManager.clear(),
      buildDirtyValues: (values) => deps.dirtyManager.buildDirtyValues(values),
      getInitialValues: () => deps.getInitialValues(),
      setInitialValues: (values) => deps.setInitialValues(values),
      resetHistory: (initialValues) => deps.getHistory().reset(initialValues),
      emitFieldChange: (event) => deps.getEffects().onFieldChange(event),
      emitBeforeSubmit: (event) => deps.getEffects().beforeSubmit(event),
      emitAfterSubmit: (event) => deps.getEffects().afterSubmit(event),
      emitOperationalError: (event) =>
        deps.getEffects().reportOperationalError(event),
    },
    arrayPort: {
      getState: () => deps.getState(),
      setFieldWithMeta: (path, value, meta) =>
        deps.setFieldWithMeta(path, value, meta),
      emitFieldChange: (event) => deps.getEffects().onFieldChange(event),
      dispatch: (operation) => deps.dispatch(operation),
      internalSaveSnapshot: () => deps.saveHistorySnapshot(),
      unregisterPrefix: (prefix) => deps.unregisterPrefix(prefix),
      triggerValidation: (scopeFields) => deps.triggerValidation(scopeFields),
      updateDirtyForPath: (path, nextValues, baselineValues) =>
        deps.dirtyManager.updateForPath(path, nextValues, baselineValues),
      getConfig: () => deps.getConfig(),
    },
    getScopeFields: (scopeName) => deps.getScopeFields(scopeName),
    getState: () => deps.getState(),
    dispatch: (operation) => deps.dispatch(operation),
    getInitialValues: () => deps.getInitialValues(),
    isPathDirty: (path) => deps.dirtyManager.isPathDirty(path),
  };
}
