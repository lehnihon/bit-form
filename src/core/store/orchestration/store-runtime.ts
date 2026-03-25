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
import type { BitBaselineManager } from "../managers/core/baseline-manager";

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
  setFieldWithMeta(
    path: string,
    value: unknown,
    meta?: BitFieldChangeMeta,
  ): void;
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
  baselineManager: BitBaselineManager<T>;
  stateAccess: BitStoreRuntimeStateAccess<T>;
  fieldAccess: BitStoreRuntimeFieldAccess<T>;
  featureAccess: BitStoreRuntimeFeatureAccess<T>;
  actions: BitStoreRuntimeActions<T>;
}

export function createStoreRuntime<T extends object>(
  args: CreateStoreRuntimeArgs<T>,
): BitStoreRuntimeMembers<T> {
  const {
    config,
    fieldRegistry,
    dirtyManager,
    computedManager,
    rawConfig,
    baselineManager,
    stateAccess,
    fieldAccess,
    featureAccess,
    actions,
  } = args;

  const validationPort = createValidationPort<T>({
    config,
    fieldRegistry,
    getState: stateAccess.getState,
    dispatch: stateAccess.dispatch,
    setError: actions.setError,
    validate: actions.validate,
    getFieldConfig: fieldAccess.getFieldConfig,
    getScopeFields: fieldAccess.getScopeFields,
    getEffects: featureAccess.getEffects,
  });

  const lifecyclePort = createLifecyclePort<T>({
    config,
    fieldRegistry,
    dirtyManager,
    getState: stateAccess.getState,
    dispatch: stateAccess.dispatch,
    saveHistorySnapshot: stateAccess.saveHistorySnapshot,
    runStateBatch: stateAccess.runStateBatch,
    getTransformEntries: fieldAccess.getTransformEntries,
    getBaselineValues: () => baselineManager.getValues(),
    setBaselineValues: (values) => baselineManager.setValues(values),
    getValidation: featureAccess.getValidation,
    getHistory: featureAccess.getHistory,
    getEffects: featureAccess.getEffects,
  });

  const arrayPort = createArrayPort<T>({
    getState: stateAccess.getState,
    dispatch: stateAccess.dispatch,
    setFieldWithMeta: (path, value, meta) =>
      actions.setFieldWithMeta(path, value, meta),
    unregisterPrefix: actions.unregisterPrefix,
    triggerValidation: (scopeFields, options) =>
      actions.triggerValidation(scopeFields, options),
    dirtyManager,
    getConfig: actions.getConfig,
    getEffects: featureAccess.getEffects,
    saveHistorySnapshot: stateAccess.saveHistorySnapshot,
  });

  const capabilities = createStoreCapabilities<T>({
    ports: {
      config,
      validationPort,
      lifecyclePort,
      arrayPort,
      getScopeFields: fieldAccess.getScopeFields,
      getState: stateAccess.getState,
      dispatch: stateAccess.dispatch,
      getBaselineValues: () => baselineManager.getValues(),
      isPathDirty: (path) => dirtyManager.isPathDirty(path),
    },
    fieldRegistry,
  });

  const state = createInitialStoreState<T>({
    config,
    fieldRegistry,
    computedManager,
  });

  const subscriptions = new BitSubscriptionEngine<T>(
    stateAccess.getState,
    config.subscriptionCacheSize,
  );

  const storeId =
    rawConfig.storeId ||
    config.name ||
    config.idFactory({
      scope: "store",
      storeName: config.name,
    });

  return {
    state,
    subscriptions,
    capabilities,
    storeId,
  };
}
