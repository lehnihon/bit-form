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
import { BitFieldRegistry } from "../registry/field-registry";
import { BitComputedManager } from "../managers/core/computed-manager";
import { analyzeCyclicDependencies } from "../managers/core/computed-dependency-analyzer";
import type { BitStoreOperation } from "../engines/operation-engine";
import { deepClone } from "../../utils";
import type { BitStoreCapabilities } from "./capabilities";
import type { BitFrameworkConfig } from "../contracts/public/store-api-types";
import { bitBus, getNoopBitBus } from "../shared/bus";
import type { BitBusStorePort } from "../contracts/bus-types";
import type {
  BitLifecycleStorePort,
  BitValidationStorePort,
} from "../contracts/port-types";
import type { BitFieldDefinition, BitState } from "../contracts/types";

function shouldEnableStoreBus<T extends object>(config: BitFrameworkConfig<T>) {
  if (config.bus) {
    return true;
  }

  if (typeof config.devTools === "boolean") {
    return config.devTools;
  }

  if (config.devTools && typeof config.devTools === "object") {
    return config.devTools.enabled !== false;
  }

  return false;
}

export type BitStoreCapabilityPorts<T extends object> = {
  validationPort: BitValidationStorePort<T>;
  lifecyclePort: BitLifecycleStorePort<T>;
  arrayPort: BitArrayStorePort<T>;
  config: BitFrameworkConfig<T>;
  getScopeFields(scopeName: string): string[];
  getState(): BitState<T>;
  dispatch(operation: BitStoreOperation<T>): void;
  getBaselineValues(): T;
  isPathDirty(path: string): boolean;
};

export function createStoreCapabilities<T extends object>(args: {
  ports: BitStoreCapabilityPorts<T>;
  fieldRegistry: BitFieldRegistry<T>;
}): BitStoreCapabilities<T> {
  const { ports, fieldRegistry } = args;

  return {
    validation: new BitValidationManager<T>(ports.validationPort),
    lifecycle: new BitLifecycleManager<T>(ports.lifecyclePort),
    history: new BitHistoryManager<T>(
      !!ports.config.history.enabled,
      ports.config.history.limit ?? 50,
    ),
    arrays: new BitArrayManager<T>(ports.arrayPort),
    scope: new BitScopeManager<T>(
      () => ports.getState(),
      () => ports.getBaselineValues(),
      (scopeName) => ports.getScopeFields(scopeName),
      (path) => ports.isPathDirty(path),
    ),
    query: new BitFieldQueryManager<T>(
      fieldRegistry,
      () => ports.getState(),
      (path) => ports.isPathDirty(path),
    ),
    error: new BitErrorManager<T>(
      () => ports.getState(),
      (operation) => ports.dispatch(operation),
    ),
  };
}

export function createStoreEffects<T extends object>(args: {
  storeId: string;
  storeBusPort: BitBusStorePort<T>;
  config: BitFrameworkConfig<T>;
  getState: () => BitState<T>;
  getConfig: () => BitFrameworkConfig<T>;
  getValues: () => T;
  getDirtyValues: () => Partial<T>;
  applyPersistedValues: (values: Partial<T>) => void;
}): BitStoreEffectEngine<T> {
  const {
    storeId,
    storeBusPort,
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

  const pluginManager = new BitPluginManager<T>([...config.plugins], () => ({
    storeId,
    getState: () => getState(),
    getConfig: () => getConfig(),
  }));

  const enableBusDispatch = shouldEnableStoreBus(config);
  const resolvedBus = enableBusDispatch
    ? (config.bus ?? bitBus)
    : getNoopBitBus();

  const effects = new BitStoreEffectEngine<T>(
    storeId,
    storeBusPort,
    resolvedBus,
    persistManager,
    pluginManager,
    enableBusDispatch,
  );
  effects.initialize();

  return effects;
}

export function createInitialStoreState<T extends object>(args: {
  config: BitFrameworkConfig<T>;
  fieldRegistry: BitFieldRegistry<T>;
  computedManager: BitComputedManager<T>;
}): BitState<T> {
  const { config, fieldRegistry, computedManager } = args;

  const initialValues = deepClone(config.initialValues);

  if (config.fields) {
    Object.entries(config.fields).forEach(([path, fieldConfig]) => {
      fieldRegistry.register(
        path,
        fieldConfig as BitFieldDefinition<T>,
        initialValues,
      );
    });
  }

  const computedCycles = analyzeCyclicDependencies(
    fieldRegistry.getComputedEntries(),
  );

  if (computedCycles.length > 0) {
    throw new Error(computedCycles[0].message);
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
