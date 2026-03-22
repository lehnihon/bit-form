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
import type { BitStoreOperation } from "../engines/operation-engine";
import { deepClone } from "../../utils";
import type { BitStoreCapabilities } from "./capabilities";
import type { BitFrameworkConfig } from "../contracts/public-types";
import { bitBus } from "../shared/bus";
import type {
  BitLifecycleStorePort,
  BitValidationStorePort,
} from "../contracts/port-types";
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
      () => ports.getInitialValues(),
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

  const pluginManager = new BitPluginManager<T>([...config.plugins], () => ({
    storeId,
    getState: () => getState(),
    getConfig: () => getConfig(),
  }));

  const effects = new BitStoreEffectEngine<T>(
    storeId,
    storeInstance,
    config.bus ?? bitBus,
    persistManager,
    pluginManager,
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
