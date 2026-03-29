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
import { applyValueDerivations } from "../shared/value-derivation-pipeline";
import type { BitStoreCapabilities } from "./capabilities";
import {
  createStoreCapabilityRegistry,
  type BitStoreCapabilityRegistry,
} from "./store-capability-registry";
import type { BitFrameworkConfig } from "../contracts/public/store-api-types";
import type {
  BitLifecyclePorts,
  BitValidationManagerPort,
} from "../contracts/port-types";
import type { BitFieldDefinition, BitState } from "../contracts/types";

export type BitStoreCapabilityPorts<T extends object> = {
  validationPort: BitValidationManagerPort<T>;
  lifecyclePorts: BitLifecyclePorts<T>;
  arrayPort: BitArrayStorePort<T>;
  config: BitFrameworkConfig<T>;
  getScopeFields(scopeName: string): string[];
  getState(): BitState<T>;
  dispatch(operation: BitStoreOperation<T>): void;
  getBaselineValues(): T;
  isPathDirty(path: string): boolean;
};

export interface BitStoreCapabilityComposition<T extends object> {
  registry: BitStoreCapabilityRegistry<T>;
  capabilities: BitStoreCapabilities<T>;
}

function registerStoreCapabilities<T extends object>(args: {
  registry: BitStoreCapabilityRegistry<T>;
  ports: BitStoreCapabilityPorts<T>;
  fieldRegistry: BitFieldRegistry<T>;
}) {
  const { registry, ports, fieldRegistry } = args;

  registry.register(
    "validation",
    new BitValidationManager<T>(ports.validationPort),
  );
  registry.register(
    "lifecycle",
    new BitLifecycleManager<T>(ports.lifecyclePorts),
  );
  registry.register(
    "history",
    new BitHistoryManager<T>(
      !!ports.config.history.enabled,
      ports.config.history.limit ?? 50,
    ),
  );
  registry.register("arrays", new BitArrayManager<T>(ports.arrayPort));
  registry.register(
    "scope",
    new BitScopeManager<T>(
      () => ports.getState(),
      () => ports.getBaselineValues(),
      (scopeName) => ports.getScopeFields(scopeName),
      (path) => ports.isPathDirty(path),
    ),
  );
  registry.register(
    "query",
    new BitFieldQueryManager<T>(
      fieldRegistry,
      () => ports.getState(),
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
}

export function composeStoreCapabilities<T extends object>(args: {
  ports: BitStoreCapabilityPorts<T>;
  fieldRegistry: BitFieldRegistry<T>;
}): BitStoreCapabilityComposition<T> {
  const { ports, fieldRegistry } = args;
  const registry = createStoreCapabilityRegistry<T>();
  registerStoreCapabilities({ registry, ports, fieldRegistry });

  return {
    registry,
    capabilities: registry.toCapabilities(),
  };
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

  const initialDerivedValues = applyValueDerivations({
    values: initialValues,
    normalizerEntries: fieldRegistry.getNormalizerEntries(),
    applyComputed: (values, changedPaths) =>
      computedManager.apply(values, changedPaths),
  });

  return {
    values: initialDerivedValues,
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
