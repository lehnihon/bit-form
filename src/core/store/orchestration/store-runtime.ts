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
  storeInstance: unknown;
  getState(): BitState<T>;
  dispatch(operation: BitStoreOperation<T>): void;
  setError(path: string, message: string | undefined): void;
  validate(options?: {
    scope?: string;
    scopeFields?: string[];
  }): Promise<boolean>;
  getFieldConfig(path: string): BitFieldDefinition<T> | undefined;
  getScopeFields(scopeName: string): string[];
  getEffects(): BitStoreEffectEngine<T>;
  saveHistorySnapshot(): void;
  runStateBatch<TResult>(callback: () => TResult): TResult;
  getTransformEntries(): [string, BitTransformFn<T>][];
  getHistory(): BitStoreCapabilities<T>["history"];
  getValidation(): BitStoreCapabilities<T>["validation"];
  setFieldWithMeta(path: string, value: any, meta?: BitFieldChangeMeta): void;
  unregisterPrefix(prefix: string): void;
  triggerValidation(
    scopeFields?: string[],
    options?: BitValidationTriggerOptions,
  ): void;
  getConfig(): Readonly<BitFrameworkConfig<T>>;
  getDirtyValues(): Partial<T>;
  applyPersistedValues(values: Partial<T>): void;
}

export function createStoreRuntime<T extends object>(
  args: CreateStoreRuntimeArgs<T>,
): BitStoreRuntimeMembers<T> {
  const validationPort = createValidationPort<T>({
    config: args.config,
    fieldRegistry: args.fieldRegistry,
    getState: () => args.getState(),
    dispatch: (operation) => args.dispatch(operation),
    setError: (path, message) => args.setError(path, message),
    validate: (options) => args.validate(options),
    getFieldConfig: (path) => args.getFieldConfig(path),
    getScopeFields: (scopeName) => args.getScopeFields(scopeName),
    getEffects: () => args.getEffects(),
  });

  const lifecyclePort = createLifecyclePort<T>({
    config: args.config,
    fieldRegistry: args.fieldRegistry,
    dirtyManager: args.dirtyManager,
    getState: () => args.getState(),
    dispatch: (operation) => args.dispatch(operation),
    saveHistorySnapshot: () => args.saveHistorySnapshot(),
    runStateBatch: (callback) => args.runStateBatch(callback),
    getTransformEntries: () => args.getTransformEntries(),
    getInitialValues: () => args.initialValuesRef.get(),
    setInitialValues: (values) => args.initialValuesRef.set(values),
    getValidation: () => args.getValidation(),
    getHistory: () => args.getHistory(),
    getEffects: () => args.getEffects(),
  });

  const arrayPort = createArrayPort<T>({
    getState: () => args.getState(),
    dispatch: (operation) => args.dispatch(operation),
    setFieldWithMeta: (path, value, meta) =>
      args.setFieldWithMeta(path, value, meta),
    unregisterPrefix: (prefix) => args.unregisterPrefix(prefix),
    triggerValidation: (scopeFields, options) =>
      args.triggerValidation(scopeFields, options),
    dirtyManager: args.dirtyManager,
    getConfig: () => args.getConfig(),
    getEffects: () => args.getEffects(),
    saveHistorySnapshot: () => args.saveHistorySnapshot(),
  });

  const capabilities = createStoreCapabilities<T>({
    ports: {
      config: args.config,
      validationPort,
      lifecyclePort,
      arrayPort,
      getScopeFields: (scopeName) => args.getScopeFields(scopeName),
      getState: () => args.getState(),
      dispatch: (operation) => args.dispatch(operation),
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
    () => args.getState(),
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
