import { createDevtoolsPlugin } from "../managers/features/devtools-plugin";
import { BitPersistManager } from "../managers/features/persist-manager";
import { BitPluginManager } from "../managers/features/plugin-manager";
import { BitStoreEffectEngine } from "../engines/effect-engine";
import { BitValidationManager } from "../managers/features/validation-manager";
import { BitLifecycleManager } from "../managers/features/lifecycle-manager";
import { BitHistoryManager } from "../managers/features/history-manager";
import {
  BitArrayManager,
  type BitArrayStorePort,
} from "../managers/features/array-manager";
import { BitComputedManager } from "../managers/core/computed-manager";
import { BitScopeManager } from "../managers/features/scope-manager";
import { BitFieldQueryManager } from "../managers/features/field-query-manager";
import { BitErrorManager } from "../managers/features/error-manager";
import { BitCapabilityRegistry } from "./capability-registry";
import { BitDependencyManager } from "../managers/core/dependency-manager";
import { BitDirtyManager } from "../managers/core/dirty-manager";
import { deepClone } from "../../utils";
import type { BitStoreCapabilities } from "./capabilities";
import type { BitFrameworkConfig } from "../contracts/public-types";
import type { BitLifecycleStorePort } from "../managers/features/lifecycle-manager";
import type { BitValidationStorePort } from "../managers/features/validation-manager";
import type { BitFieldDefinition, BitState } from "../contracts/types";

type BitStoreCapabilityPorts<T extends object> = BitValidationStorePort<T> &
  BitLifecycleStorePort<T> &
  BitArrayStorePort<T> & {
    getScopeFields(scopeName: string): string[];
    getState(): BitState<T>;
    internalUpdateState(partialState: Partial<BitState<T>>): void;
  };

export function createStoreCapabilities<T extends object>(args: {
  store: BitStoreCapabilityPorts<T>;
  dependencyManager: BitDependencyManager<T>;
  dirtyManager: BitDirtyManager<T>;
}): BitCapabilityRegistry<BitStoreCapabilities<T>> {
  const { store, dependencyManager, dirtyManager } = args;

  const capabilities = new BitCapabilityRegistry<BitStoreCapabilities<T>>();

  const validationPort: BitValidationStorePort<T> = {
    getState: () => store.getState(),
    internalUpdateState: (partial) => store.internalUpdateState(partial),
    setError: (path, message) => store.setError(path, message),
    validate: (opts) => store.validate(opts),
    getFieldConfig: (path) => store.getFieldConfig(path),
    getScopeFields: (scopeName) => store.getScopeFields(scopeName),
    config: store.config,
    getRequiredErrors: (values) => store.getRequiredErrors(values),
    getHiddenFields: () => store.getHiddenFields(),
    emitBeforeValidate: (event) => store.emitBeforeValidate(event),
    emitAfterValidate: (event) => store.emitAfterValidate(event),
  };

  const lifecyclePort: BitLifecycleStorePort<T> = {
    getState: () => store.getState(),
    internalUpdateState: (partial, changedPaths) =>
      store.internalUpdateState(partial, changedPaths),
    internalSaveSnapshot: () => store.internalSaveSnapshot(),
    batchStateUpdates: (callback) => store.batchStateUpdates(callback),
    config: store.config,
    getTransformEntries: () => store.getTransformEntries(),
    updateDependencies: (changedPath, newValues) =>
      store.updateDependencies(changedPath, newValues),
    isFieldHidden: (path) => store.isFieldHidden(path),
    evaluateAllDependencies: (values) => store.evaluateAllDependencies(values),
    getHiddenFields: () => store.getHiddenFields(),
    clearFieldValidation: (path) => store.clearFieldValidation(path),
    triggerValidation: (scopeFields, options) =>
      store.triggerValidation(scopeFields, options),
    handleFieldAsyncValidation: (path, value) =>
      store.handleFieldAsyncValidation(path, value),
    cancelAllValidations: () => store.cancelAllValidations(),
    validateNow: (options) => store.validateNow(options),
    hasValidationsInProgress: (scopeFields) =>
      store.hasValidationsInProgress(scopeFields),
    updateDirtyForPath: (path, nextValues, baselineValues) =>
      store.updateDirtyForPath(path, nextValues, baselineValues),
    rebuildDirtyState: (nextValues, baselineValues) =>
      store.rebuildDirtyState(nextValues, baselineValues),
    clearDirtyState: () => store.clearDirtyState(),
    buildDirtyValues: (values) => store.buildDirtyValues(values),
    resetHistory: (initialValues) => store.resetHistory(initialValues),
    emitFieldChange: (event) => store.emitFieldChange(event),
    emitBeforeSubmit: (event) => store.emitBeforeSubmit(event),
    emitAfterSubmit: (event) => store.emitAfterSubmit(event),
    emitOperationalError: (event) => store.emitOperationalError(event),
  };

  capabilities.register(
    "validation",
    new BitValidationManager<T>(validationPort),
  );
  capabilities.register("lifecycle", new BitLifecycleManager<T>(lifecyclePort));
  capabilities.register(
    "history",
    new BitHistoryManager<T>(
      !!store.config.enableHistory,
      store.config.historyLimit ?? 15,
    ),
  );
  capabilities.register("arrays", new BitArrayManager<T>(store));
  capabilities.register(
    "scope",
    new BitScopeManager<T>(
      () => store.getState(),
      () => store.config.initialValues,
      (scopeName) => store.getScopeFields(scopeName),
      (path) => dirtyManager.isPathDirty(path),
    ),
  );
  capabilities.register(
    "query",
    new BitFieldQueryManager<T>(
      dependencyManager,
      () => store.getState(),
      () => store.config,
      (path) => dirtyManager.isPathDirty(path),
    ),
  );
  capabilities.register(
    "error",
    new BitErrorManager<T>(
      () => store.getState(),
      (partial) => store.internalUpdateState(partial),
    ),
  );

  return capabilities;
}

export function createStoreEffects<T extends object>(args: {
  storeId: string;
  storeInstance: unknown;
  config: BitFrameworkConfig<T>;
  getState: () => BitState<T>;
  getConfig: () => BitFrameworkConfig<T>;
  getValues: () => T;
  getDirtyValues: () => Partial<T>;
  applyPersistedValues: (values: Partial<T>) => void;
}): BitStoreEffectEngine<T> {
  const {
    storeId,
    storeInstance,
    config,
    getState,
    getConfig,
    getValues,
    getDirtyValues,
    applyPersistedValues,
  } = args;

  const persistManager = new BitPersistManager<T>(
    config.persist,
    getValues,
    getDirtyValues,
    applyPersistedValues,
  );

  const runtimePlugins = [...config.plugins];
  const devtoolsPlugin = createDevtoolsPlugin<T>(config.devTools);
  if (devtoolsPlugin) {
    runtimePlugins.push(devtoolsPlugin);
  }

  const pluginManager = new BitPluginManager<T>(runtimePlugins, () => ({
    storeId,
    getState: () => getState(),
    getConfig: () => getConfig(),
  }));

  const effects = new BitStoreEffectEngine<T>(
    storeId,
    storeInstance,
    persistManager,
    pluginManager,
  );
  effects.initialize();

  return effects;
}

export function createInitialStoreState<T extends object>(args: {
  config: BitFrameworkConfig<T>;
  dependencyManager: BitDependencyManager<T>;
  computedManager: BitComputedManager<T>;
}): BitState<T> {
  const { config, dependencyManager, computedManager } = args;

  const initialValues = deepClone(config.initialValues);

  if (config.fields) {
    Object.entries(config.fields).forEach(([path, fieldConfig]) => {
      dependencyManager.register(
        path,
        fieldConfig as BitFieldDefinition<T>,
        initialValues,
      );
    });
  }

  const valuesWithComputeds = computedManager.apply(initialValues);

  return {
    values: valuesWithComputeds,
    errors: {},
    touched: {},
    isValidating: {},
    persist: {
      isSaving: false,
      isRestoring: false,
      error: null,
    },
    isValid: true,
    isSubmitting: false,
    isDirty: false,
  };
}
