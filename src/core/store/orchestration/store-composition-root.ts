import { applyValueDerivations } from "../shared/value-derivation-pipeline";
import type { BitConfig, BitFieldChangeMeta } from "../contracts/types";
import type { BitFrameworkConfig } from "../contracts/public/store-api-types";
import type { BitValidationTriggerOptions } from "../contracts/port-types";
import { BitComputedManager } from "../managers/core/computed-manager";
import { BitDirtyManager } from "../managers/core/dirty-manager";
import { BitMaskManager } from "../managers/features/mask-manager";
import { BitFieldRegistry } from "../registry/field-registry";
import { normalizeConfig } from "../shared/config";
import { createStoreEffects } from "./store-effects-composition";
import { unregisterStorePrefix } from "./store-registration-ops";
import { applyStorePersistedValues } from "./store-persist-ops";
import { createStoreRuntime } from "./store-runtime";
import { BitStoreRuntimeKernel } from "./store-runtime-kernel";
import { BitBaselineManager } from "../managers/core/baseline-manager";
import type { BitBusStorePort } from "../contracts/bus-types";

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

export function composeBitStoreRuntime<T extends object>(args: {
  rawConfig: BitConfig<T>;
  storeBusPort: BitBusStorePort<T>;
}): BitStoreComposition<T> {
  const { rawConfig, storeBusPort } = args;
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
    runtimeContext: {
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
        getHistory: () => getRuntimeKernel().getCapability("history"),
        getValidation: () => getRuntimeKernel().getCapability("validation"),
      },
      actions: {
        setError: (path, message) => {
          getRuntimeKernel().getCapability("error").setError(path, message);
        },
        validate: (options) => {
          return getRuntimeKernel()
            .getCapability("validation")
            .validate(options);
        },
        setFieldWithMeta: (
          path,
          value,
          meta: BitFieldChangeMeta = { origin: "setField" },
        ) => {
          getRuntimeKernel().runBatch(() => {
            getRuntimeKernel()
              .getCapability("lifecycle")
              .updateField(path, value, meta);
          });
        },
        unregisterPrefix: (prefix) => {
          unregisterStorePrefix({
            prefix,
            state: getRuntimeKernel().getState(),
            fieldRegistry,
            subscriptions: getRuntimeKernel().subscriptions,
            validationCleanupPrefix: (fieldPrefix) =>
              getRuntimeKernel()
                .getCapability("validation")
                .cleanupPrefix(fieldPrefix),
            invalidateFieldIndexes,
          });
        },
        triggerValidation: (
          scopeFields?: string[],
          options?: BitValidationTriggerOptions,
        ) => {
          getRuntimeKernel()
            .getCapability("validation")
            .trigger(scopeFields, options);
        },
      },
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
      validation: getRuntimeKernel().getCapability("validation"),
      fieldRegistry,
      dirtyManager,
      dispatch: (operation) => getRuntimeKernel().dispatch(operation),
      saveHistorySnapshot: () => getRuntimeKernel().saveHistorySnapshot(),
    });
  };

  const effects = createStoreEffects<T>({
    storeId: runtime.storeId,
    storeBusPort,
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
    capabilityRegistry: runtime.capabilityRegistry,
    capabilities: runtime.capabilities,
    applyValueDerivations: (values, changedPaths) =>
      applyValueDerivations({
        values,
        changedPaths,
        normalizerEntries: fieldRegistry.getNormalizerEntries(),
        applyComputed: (nextValues, nextChangedPaths) =>
          computedManager.apply(nextValues, nextChangedPaths),
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
