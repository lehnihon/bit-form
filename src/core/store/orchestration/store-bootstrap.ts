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
import { deepClone } from "../../utils";
import type { BitStoreCapabilities } from "./capabilities";
import type { BitResolvedConfig } from "../contracts/public-types";
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
}): BitCapabilityRegistry<BitStoreCapabilities<T>> {
  const { store, dependencyManager } = args;

  const capabilities = new BitCapabilityRegistry<BitStoreCapabilities<T>>();

  capabilities.register("validation", new BitValidationManager<T>(store));
  capabilities.register("lifecycle", new BitLifecycleManager<T>(store));
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
    ),
  );
  capabilities.register(
    "query",
    new BitFieldQueryManager<T>(
      dependencyManager,
      () => store.getState(),
      () => store.config,
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
  config: BitResolvedConfig<T>;
  getState: () => BitState<T>;
  getConfig: () => BitResolvedConfig<T>;
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
  config: BitResolvedConfig<T>;
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
    isValid: true,
    isSubmitting: false,
    isDirty: false,
  };
}
