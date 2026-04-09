import type { BitValidationTriggerOptions } from "../contracts/port-types";
import type { BitFrameworkConfig } from "../contracts/public/store-api-types";
import type {
  BitFieldChangeMeta,
  BitFieldDefinition,
  BitState,
  BitTransformFn,
} from "../contracts/types";
import type { BitStoreEffectEngine } from "../engines/effect-engine";
import type { BitStoreOperation } from "../engines/operation-engine";
import type { BitBaselineManager } from "../managers/core/baseline-manager";
import type { BitDirtyManager } from "../managers/core/dirty-manager";
import type { BitNormalizerEntry } from "../registry/field-catalog";
import type { BitFieldRegistry } from "../registry/field-registry";
import type { BitStoreCapabilities } from "./capabilities";
import {
  createArrayPort,
  createLifecyclePort,
  createValidationPort,
} from "./capability-ports";
import {
  composeStoreCapabilities,
  type BitStoreCapabilityComposition,
} from "./store-bootstrap";

type BitRuntimeValidationOptions =
  | {
      scope: string;
      scopeFields?: never;
    }
  | {
      scope?: never;
      scopeFields: string[];
    }
  | {
      scope?: undefined;
      scopeFields?: undefined;
    };

export interface BitStoreRuntimeStateAccess<T extends object> {
  getState(): BitState<T>;
  dispatch(operation: BitStoreOperation<T>): void;
  saveHistorySnapshot(): void;
  runStateBatch<TResult>(callback: () => TResult): TResult;
}

export interface BitStoreRuntimeFieldAccess<T extends object> {
  getFieldConfig(path: string): BitFieldDefinition<T> | undefined;
  getScopeFields(scopeName: string): string[];
  getNormalizerEntries(): BitNormalizerEntry<T>[];
  getTransformEntries(): [string, BitTransformFn<T>][];
}

export interface BitStoreRuntimeFeatureAccess<T extends object> {
  getEffects(): BitStoreEffectEngine<T>;
  getHistory(): BitStoreCapabilities<T>["history"];
  getValidation(): BitStoreCapabilities<T>["validation"];
}

export interface BitStoreRuntimeActions<_T extends object> {
  setError(path: string, message: string | undefined): void;
  setServerErrors(
    serverErrors: Record<string, string[] | string>,
    options?: { arrayStrategy?: "first" | "join"; joinSeparator?: string },
  ): void;
  validate(options?: BitRuntimeValidationOptions): Promise<boolean>;
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
}

export interface BitStoreRuntimeContext<T extends object> {
  stateAccess: BitStoreRuntimeStateAccess<T>;
  fieldAccess: BitStoreRuntimeFieldAccess<T>;
  featureAccess: BitStoreRuntimeFeatureAccess<T>;
  actions: BitStoreRuntimeActions<T>;
}

export interface ComposeRuntimeFeatureCapabilitiesArgs<T extends object> {
  config: BitFrameworkConfig<T>;
  fieldRegistry: BitFieldRegistry<T>;
  dirtyManager: BitDirtyManager<T>;
  baselineManager: BitBaselineManager<T>;
  runtimeContext: BitStoreRuntimeContext<T>;
}

export function composeRuntimeFeatureCapabilities<T extends object>(
  args: ComposeRuntimeFeatureCapabilitiesArgs<T>,
): BitStoreCapabilityComposition<T> {
  const {
    config,
    fieldRegistry,
    dirtyManager,
    baselineManager,
    runtimeContext,
  } = args;
  const { stateAccess, fieldAccess, featureAccess, actions } = runtimeContext;

  const validationPort = createValidationPort<T>({
    config,
    fieldRegistry,
    getState: stateAccess.getState,
    dispatch: stateAccess.dispatch,
    setError: actions.setError,
    getFieldConfig: fieldAccess.getFieldConfig,
    getScopeFields: fieldAccess.getScopeFields,
    getEffects: featureAccess.getEffects,
  });

  const lifecyclePorts = createLifecyclePort<T>({
    config,
    fieldRegistry,
    dirtyManager,
    getState: stateAccess.getState,
    dispatch: stateAccess.dispatch,
    setServerErrors: actions.setServerErrors,
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
    remapValidationPaths: (path, remapIndex) =>
      featureAccess.getValidation().remapArrayPaths(path, remapIndex),
    saveHistorySnapshot: stateAccess.saveHistorySnapshot,
    createArrayItemId: (path, index) =>
      config.idFactory({ scope: "array", path, index }),
  });

  return composeStoreCapabilities<T>({
    ports: {
      validationPort,
      lifecyclePorts,
      arrayPort,
      config,
      getScopeFields: fieldAccess.getScopeFields,
      getState: stateAccess.getState,
      dispatch: stateAccess.dispatch,
      getBaselineValues: () => baselineManager.getValues(),
      isPathDirty: (path) => dirtyManager.isPathDirty(path),
    },
    fieldRegistry,
  });
}
