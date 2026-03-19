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
import { BitScopeManager } from "../managers/features/scope-manager";
import { BitFieldQueryManager } from "../managers/features/field-query-manager";
import { BitErrorManager } from "../managers/features/error-manager";
import { BitDependencyManager } from "../managers/core/dependency-manager";
import { BitComputedManager } from "../managers/core/computed-manager";
import { BitCapabilityRegistry } from "./capability-registry";
import type { BitStoreOperation } from "../engines/operation-engine";
import { deepClone } from "../../utils";
import type { BitStoreCapabilities } from "./capabilities";
import type { BitFrameworkConfig } from "../contracts/public-types";
import type { BitLifecycleStorePort } from "../managers/features/lifecycle-manager";
import type { BitValidationStorePort } from "../managers/features/validation-manager";
import type { BitFieldDefinition, BitState } from "../contracts/types";

export type BitStoreCapabilityPorts<T extends object> = {
  config: BitFrameworkConfig<T>;
  validationPort: BitValidationStorePort<T>;
  lifecyclePort: BitLifecycleStorePort<T>;
  arrayPort: BitArrayStorePort<T>;
  getScopeFields(scopeName: string): string[];
  getState(): BitState<T>;
  dispatch(operation: BitStoreOperation<T>): void;
  getInitialValues(): T;
  isPathDirty(path: string): boolean;
};

export function createStoreCapabilities<T extends object>(args: {
  ports: BitStoreCapabilityPorts<T>;
  dependencyManager: BitDependencyManager<T>;
}): BitStoreCapabilities<T> {
  const { ports, dependencyManager } = args;
  const registry = new BitCapabilityRegistry<BitStoreCapabilities<T>>();

  registry.register(
    "validation",
    new BitValidationManager<T>(ports.validationPort),
  );
  registry.register(
    "lifecycle",
    new BitLifecycleManager<T>(ports.lifecyclePort),
  );
  registry.register(
    "history",
    new BitHistoryManager<T>(
      !!ports.config.history.enabled,
      ports.config.history.limit ?? 15,
    ),
  );
  registry.register("arrays", new BitArrayManager<T>(ports.arrayPort));
  registry.register(
    "scope",
    new BitScopeManager<T>(
      () => ports.getState(),
      () => ports.getInitialValues(),
      (scopeName) => ports.getScopeFields(scopeName),
      (path) => ports.isPathDirty(path),
    ),
  );
  registry.register(
    "query",
    new BitFieldQueryManager<T>(
      dependencyManager,
      () => ports.getState(),
      () => ports.config,
      (path) => ports.isPathDirty(path),
    ),
  );
  registry.register(
    "error",
    new BitErrorManager<T>(
      () => ports.getState(),
      (operation) => ports.dispatch(operation),
    ),
  );

  return {
    validation: registry.get("validation"),
    lifecycle: registry.get("lifecycle"),
    history: registry.get("history"),
    arrays: registry.get("arrays"),
    scope: registry.get("scope"),
    query: registry.get("query"),
    error: registry.get("error"),
  };
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
