import { BitSubscriptionEngine } from "../engines/subscription-engine";
import type { BitStoreEffectEngine } from "../engines/effect-engine";
import {
  createArrayPort,
  createLifecyclePort,
  createValidationPort,
} from "./capability-ports";
import {
  createInitialStoreState,
  createStoreCapabilities,
} from "./store-bootstrap";
import type { BitStoreCapabilities } from "./capabilities";
import type { BitStoreOperation } from "../engines/operation-engine";
import type { BitValidationTriggerOptions } from "../contracts/port-types";
import type { BitFrameworkConfig } from "../contracts/public-types";
import type {
  BitConfig,
  BitFieldChangeMeta,
  BitFieldDefinition,
  BitPath,
  BitPathValue,
  BitState,
  DeepPartial,
  BitNormalizeFn,
  BitTransformFn,
} from "../contracts/types";
import type { BitFieldRegistry } from "../registry/field-registry";
import type { BitComputedManager } from "../managers/core/computed-manager";
import type { BitDirtyManager } from "../managers/core/dirty-manager";

export interface BitStoreRuntimeMembers<T extends object> {
  state: BitState<T>;
  subscriptions: BitSubscriptionEngine<T>;
  capabilities: BitStoreCapabilities<T>;
  storeId: string;
}

export interface BitStoreRuntimeStateAccess<T extends object> {
  getState(): BitState<T>;
  dispatch(operation: BitStoreOperation<T>): void;
  saveHistorySnapshot(): void;
  runStateBatch<TResult>(callback: () => TResult): TResult;
}

export interface BitStoreRuntimeFieldAccess<T extends object> {
  getFieldConfig(path: string): BitFieldDefinition<T> | undefined;
  getScopeFields(scopeName: string): string[];
  getNormalizerEntries(): [string, BitNormalizeFn<T>][];
  getTransformEntries(): [string, BitTransformFn<T>][];
}

export interface BitStoreRuntimeFeatureAccess<T extends object> {
  getEffects(): BitStoreEffectEngine<T>;
  getHistory(): BitStoreCapabilities<T>["history"];
  getValidation(): BitStoreCapabilities<T>["validation"];
}

export interface BitStoreRuntimeActions<T extends object> {
  setError(path: string, message: string | undefined): void;
  validate(options?: {
    scope?: string;
    scopeFields?: string[];
  }): Promise<boolean>;
  setFieldWithMeta(path: string, value: any, meta?: BitFieldChangeMeta): void;
  unregisterPrefix(prefix: string): void;
  triggerValidation(
    scopeFields?: string[],
    options?: BitValidationTriggerOptions,
  ): void;
  getConfig(): Readonly<BitFrameworkConfig<T>>;
}

export interface CreateStoreRuntimeArgs<T extends object> {
  rawConfig: BitConfig<T>;
  config: BitFrameworkConfig<T>;
  fieldRegistry: BitFieldRegistry<T>;
  computedManager: BitComputedManager<T>;
  dirtyManager: BitDirtyManager<T>;
  initialValuesRef: {
    get(): T;
    set(values: T): void;
  };
  stateAccess: BitStoreRuntimeStateAccess<T>;
  fieldAccess: BitStoreRuntimeFieldAccess<T>;
  featureAccess: BitStoreRuntimeFeatureAccess<T>;
  actions: BitStoreRuntimeActions<T>;
}

export function createStoreRuntime<T extends object>(
  args: CreateStoreRuntimeArgs<T>,
): BitStoreRuntimeMembers<T> {
  const validationPort = createValidationPort<T>({
    config: args.config,
    fieldRegistry: args.fieldRegistry,
    getState: () => args.stateAccess.getState(),
    dispatch: (operation) => args.stateAccess.dispatch(operation),
    setError: (path, message) => args.actions.setError(path, message),
    validate: (options) => args.actions.validate(options),
    getFieldConfig: (path) => args.fieldAccess.getFieldConfig(path),
    getScopeFields: (scopeName) => args.fieldAccess.getScopeFields(scopeName),
    getEffects: () => args.featureAccess.getEffects(),
  });

  const lifecyclePort = createLifecyclePort<T>({
    config: args.config,
    fieldRegistry: args.fieldRegistry,
    dirtyManager: args.dirtyManager,
    getState: () => args.stateAccess.getState(),
    dispatch: (operation) => args.stateAccess.dispatch(operation),
    saveHistorySnapshot: () => args.stateAccess.saveHistorySnapshot(),
    runStateBatch: (callback) => args.stateAccess.runStateBatch(callback),
    getTransformEntries: () => args.fieldAccess.getTransformEntries(),
    getInitialValues: () => args.initialValuesRef.get(),
    setInitialValues: (values) => args.initialValuesRef.set(values),
    getValidation: () => args.featureAccess.getValidation(),
    getHistory: () => args.featureAccess.getHistory(),
    getEffects: () => args.featureAccess.getEffects(),
  });

  const arrayPort = createArrayPort<T>({
    getState: () => args.stateAccess.getState(),
    dispatch: (operation) => args.stateAccess.dispatch(operation),
    setFieldWithMeta: (path, value, meta) =>
      args.actions.setFieldWithMeta(path, value, meta),
    unregisterPrefix: (prefix) => args.actions.unregisterPrefix(prefix),
    triggerValidation: (scopeFields, options) =>
      args.actions.triggerValidation(scopeFields, options),
    dirtyManager: args.dirtyManager,
    getConfig: () => args.actions.getConfig(),
    getEffects: () => args.featureAccess.getEffects(),
    saveHistorySnapshot: () => args.stateAccess.saveHistorySnapshot(),
  });

  const capabilities = createStoreCapabilities<T>({
    ports: {
      config: args.config,
      validationPort,
      lifecyclePort,
      arrayPort,
      getScopeFields: (scopeName) => args.fieldAccess.getScopeFields(scopeName),
      getState: () => args.stateAccess.getState(),
      dispatch: (operation) => args.stateAccess.dispatch(operation),
      getInitialValues: () => args.initialValuesRef.get(),
      isPathDirty: (path) => args.dirtyManager.isPathDirty(path),
    },
    fieldRegistry: args.fieldRegistry,
  });

  const state = createInitialStoreState<T>({
    config: args.config,
    fieldRegistry: args.fieldRegistry,
    computedManager: args.computedManager,
  });

  const subscriptions = new BitSubscriptionEngine<T>(
    () => args.stateAccess.getState(),
    args.config.subscriptionCacheSize,
  );

  const storeId =
    args.rawConfig.storeId ||
    args.config.name ||
    args.config.idFactory({
      scope: "store",
      storeName: args.config.name,
    });

  return {
    state,
    subscriptions,
    capabilities,
    storeId,
  };
}
