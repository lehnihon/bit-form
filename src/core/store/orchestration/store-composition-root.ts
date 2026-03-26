import { getDeepValue, setDeepValues, valueEqual } from "../../utils";
import type { BitConfig, BitFieldChangeMeta } from "../contracts/types";
import type { BitFrameworkConfig } from "../contracts/public/store-api-types";
import type { BitValidationTriggerOptions } from "../contracts/port-types";
import { BitComputedManager } from "../managers/core/computed-manager";
import { BitDirtyManager } from "../managers/core/dirty-manager";
import { BitMaskManager } from "../managers/features/mask-manager";
import { BitFieldRegistry } from "../registry/field-registry";
import { normalizeConfig } from "../shared/config";
import { createStoreEffects } from "./store-bootstrap";
import { unregisterStorePrefix } from "./store-registration-ops";
import { applyStorePersistedValues } from "./store-persist-ops";
import { createStoreRuntime } from "./store-runtime";
import { BitStoreRuntimeKernel } from "./store-runtime-kernel";
import { BitBaselineManager } from "../managers/core/baseline-manager";
import type { BitNormalizerEntry } from "../registry/field-catalog";

export interface BitStoreComposition<T extends object> {
  config: BitFrameworkConfig<T>;
  storeId: string;
  runtime: BitStoreRuntimeKernel<T>;
  fieldRegistry: BitFieldRegistry<T>;
  computedManager: BitComputedManager<T>;
  dirtyManager: BitDirtyManager<T>;
  maskManager: BitMaskManager;
  baselineManager: BitBaselineManager<T>;
}

function applyNormalizedPostBatchValues<T extends object>(args: {
  values: T;
  changedPaths?: readonly string[];
  getNormalizerEntries(): BitNormalizerEntry<T>[];
}): T {
  const { values, changedPaths, getNormalizerEntries } = args;
  const normalizers = getNormalizerEntries();

  if (normalizers.length === 0) {
    return values;
  }

  const hasWildcardChange = changedPaths?.includes("*") ?? false;

  const isDependencyImpacted = (dependencyPath: string) => {
    if (!changedPaths || changedPaths.length === 0 || hasWildcardChange) {
      return true;
    }

    return changedPaths.some(
      (changedPath) =>
        dependencyPath === changedPath ||
        dependencyPath.startsWith(`${changedPath}.`) ||
        changedPath.startsWith(`${dependencyPath}.`),
    );
  };

  const targetedNormalizers =
    !changedPaths || changedPaths.length === 0 || hasWildcardChange
      ? normalizers
      : normalizers.filter((entry) =>
          entry.dependsOn.some((dependencyPath) =>
            isDependencyImpacted(dependencyPath),
          ),
        );

  if (targetedNormalizers.length === 0) {
    return values;
  }

  const updates: Array<[string, unknown]> = [];

  for (const entry of targetedNormalizers) {
    const currentValue = getDeepValue(values, entry.path);
    const normalizedValue = entry.normalize(currentValue, values);

    if (!valueEqual(currentValue, normalizedValue)) {
      updates.push([entry.path, normalizedValue]);
    }
  }

  if (updates.length === 0) {
    return values;
  }

  return setDeepValues(values, updates);
}

export function composeBitStoreRuntime<T extends object>(args: {
  rawConfig: BitConfig<T>;
  storeInstance: unknown;
}): BitStoreComposition<T> {
  const { rawConfig, storeInstance } = args;
  const config = normalizeConfig(rawConfig);
  const baselineManager = new BitBaselineManager<T>(config.initialValues);

  const fieldRegistry = new BitFieldRegistry<T>();
  const computedManager = new BitComputedManager<T>(() =>
    fieldRegistry.getComputedEntries(),
  );
  const dirtyManager = new BitDirtyManager<T>();
  const maskManager = new BitMaskManager();

  if (config.masks) {
    Object.entries(config.masks).forEach(([name, mask]) => {
      maskManager.registerMask(name, mask);
    });
  }

  const invalidateFieldIndexes = () => {
    fieldRegistry.invalidateIndexes();
    computedManager.invalidateReverseDeps();
  };

  let runtimeKernel: BitStoreRuntimeKernel<T> | undefined;

  const getRuntimeKernel = () => {
    if (!runtimeKernel) {
      throw new Error("BitStore runtime kernel is not initialized yet.");
    }

    return runtimeKernel;
  };

  const runtime = createStoreRuntime<T>({
    rawConfig,
    config,
    fieldRegistry,
    computedManager,
    dirtyManager,
    baselineManager,
    stateAccess: {
      getState: () => runtimeKernel?.getState() ?? runtime.state,
      dispatch: (operation) => getRuntimeKernel().dispatch(operation),
      saveHistorySnapshot: () => getRuntimeKernel().saveHistorySnapshot(),
      runStateBatch: (callback) => getRuntimeKernel().runBatch(callback),
    },
    fieldAccess: {
      getFieldConfig: (path) => fieldRegistry.getFieldConfig(path),
      getScopeFields: (scopeName) => fieldRegistry.getScopeFields(scopeName),
      getNormalizerEntries: () => fieldRegistry.getNormalizerEntries(),
      getTransformEntries: () => fieldRegistry.getTransformEntries(),
    },
    featureAccess: {
      getEffects: () => getRuntimeKernel().effects,
      getHistory: () => getRuntimeKernel().capabilities.history,
      getValidation: () => getRuntimeKernel().capabilities.validation,
    },
    actions: {
      setError: (path, message) => {
        getRuntimeKernel().capabilities.error.setError(path, message);
      },
      validate: (options) => {
        return getRuntimeKernel().capabilities.validation.validate(options);
      },
      setFieldWithMeta: (
        path,
        value,
        meta: BitFieldChangeMeta = { origin: "setField" },
      ) => {
        getRuntimeKernel().runBatch(() => {
          getRuntimeKernel().capabilities.lifecycle.updateField(
            path,
            value,
            meta,
          );
        });
      },
      unregisterPrefix: (prefix) => {
        unregisterStorePrefix({
          prefix,
          state: getRuntimeKernel().getState(),
          fieldRegistry,
          subscriptions: getRuntimeKernel().subscriptions,
          validationCleanupPrefix: (fieldPrefix) =>
            getRuntimeKernel().capabilities.validation.cleanupPrefix(
              fieldPrefix,
            ),
          invalidateFieldIndexes,
        });
      },
      triggerValidation: (
        scopeFields?: string[],
        options?: BitValidationTriggerOptions,
      ) => {
        getRuntimeKernel().capabilities.validation.trigger(
          scopeFields,
          options,
        );
      },
      getConfig: () => config,
    },
  });

  const getDirtyValues = () => {
    const effectiveState = runtimeKernel?.getState() ?? runtime.state;
    return dirtyManager.buildDirtyValues(effectiveState.values);
  };

  const applyPersistedValues = (values: Partial<T>) => {
    applyStorePersistedValues({
      values,
      state: getRuntimeKernel().getState(),
      initialValues: baselineManager.getValues(),
      validation: getRuntimeKernel().capabilities.validation,
      fieldRegistry,
      dirtyManager,
      dispatch: (operation) => getRuntimeKernel().dispatch(operation),
      saveHistorySnapshot: () => getRuntimeKernel().saveHistorySnapshot(),
    });
  };

  const effects = createStoreEffects<T>({
    storeId: runtime.storeId,
    storeInstance,
    config,
    getState: () => runtimeKernel?.getState() ?? runtime.state,
    getConfig: () => config,
    getValues: () => (runtimeKernel?.getState() ?? runtime.state).values,
    getDirtyValues,
    applyPersistedValues,
  });

  runtimeKernel = new BitStoreRuntimeKernel<T>({
    state: runtime.state,
    subscriptions: runtime.subscriptions,
    effects,
    capabilities: runtime.capabilities,
    computedManager,
    applyPostBatchValues: (values, changedPaths) =>
      applyNormalizedPostBatchValues({
        values,
        changedPaths,
        getNormalizerEntries: () => fieldRegistry.getNormalizerEntries(),
      }),
  });

  runtimeKernel.saveHistorySnapshot();

  return {
    config,
    storeId: runtime.storeId,
    runtime: runtimeKernel,
    fieldRegistry,
    computedManager,
    dirtyManager,
    maskManager,
    baselineManager,
  };
}
