import { createDevtoolsPlugin } from "./devtools-plugin";
import { BitPersistManager } from "./persist-manager";
import { BitPluginManager } from "./plugin-manager";
import { BitStoreEffectEngine } from "./effect-engine";
import { BitValidationManager } from "./validation-manager";
import { BitLifecycleManager } from "./lifecycle-manager";
import { BitHistoryManager } from "./history-manager";
import { BitArrayManager, type BitArrayStorePort } from "./array-manager";
import { BitComputedManager } from "./computed-manager";
import { BitScopeManager } from "./scope-manager";
import { BitFieldQueryManager } from "./field-query-manager";
import { BitErrorManager } from "./error-manager";
import { BitCapabilityRegistry } from "./capability-registry";
import { BitDependencyManager } from "./dependency-manager";
import { deepClone } from "../utils";
import type { BitStoreCapabilities } from "./capabilities";
import type { BitResolvedConfig } from "./public-types";
import type { BitLifecycleStorePort } from "./lifecycle-manager";
import type { BitValidationStorePort } from "./validation-manager";
import type { BitFieldDefinition, BitState } from "./types";

type BitStoreCapabilityPorts<T extends object> = BitValidationStorePort<T> &
  BitLifecycleStorePort<T> &
  BitArrayStorePort<T> & {
    getScopeFields(scopeName: string): string[];
    getState(): BitState<T>;
    internalUpdateState(partialState: Partial<BitState<T>>): void;
  };

export function createStoreCapabilities<T extends object>(args: {
  store: BitStoreCapabilityPorts<T>;
  depsMg: BitDependencyManager<T>;
}): BitCapabilityRegistry<BitStoreCapabilities<T>> {
  const { store, depsMg } = args;

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
      depsMg,
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
  depsMg: BitDependencyManager<T>;
  computedMg: BitComputedManager<T>;
}): BitState<T> {
  const { config, depsMg, computedMg } = args;

  const initialValues = deepClone(config.initialValues);

  if (config.fields) {
    Object.entries(config.fields).forEach(([path, fieldConfig]) => {
      depsMg.register(
        path,
        fieldConfig as BitFieldDefinition<T>,
        initialValues,
      );
    });
  }

  const valuesWithComputeds = computedMg.apply(initialValues);

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
