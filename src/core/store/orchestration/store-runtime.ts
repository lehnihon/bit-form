import { BitSubscriptionEngine } from "../engines/subscription-engine";
import { createInitialStoreState } from "./store-bootstrap";
import type { BitStoreCapabilities } from "./capabilities";
import type { BitStoreCapabilityRegistry } from "./store-capability-registry";
import type { BitFrameworkConfig } from "../contracts/public/store-api-types";
import type {
  BitConfig,
  BitPath,
  BitPathValue,
  BitState,
  DeepPartial,
} from "../contracts/types";
import type { BitFieldRegistry } from "../registry/field-registry";
import type { BitComputedManager } from "../managers/core/computed-manager";
import type { BitDirtyManager } from "../managers/core/dirty-manager";
import type { BitBaselineManager } from "../managers/core/baseline-manager";
import {
  composeRuntimeFeatureCapabilities,
  type BitStoreRuntimeContext,
} from "./store-runtime-feature-composition";

export interface BitStoreRuntimeMembers<T extends object> {
  state: BitState<T>;
  subscriptions: BitSubscriptionEngine<T>;
  capabilityRegistry: BitStoreCapabilityRegistry<T>;
  capabilities: BitStoreCapabilities<T>;
  storeId: string;
}

export interface CreateStoreRuntimeArgs<T extends object> {
  rawConfig: BitConfig<T>;
  config: BitFrameworkConfig<T>;
  fieldRegistry: BitFieldRegistry<T>;
  computedManager: BitComputedManager<T>;
  dirtyManager: BitDirtyManager<T>;
  baselineManager: BitBaselineManager<T>;
  runtimeContext: BitStoreRuntimeContext<T>;
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
    runtimeContext,
  } = args;
  const { stateAccess, fieldAccess, featureAccess, actions } = runtimeContext;

  const capabilityComposition = composeRuntimeFeatureCapabilities<T>({
    config,
    fieldRegistry,
    dirtyManager,
    baselineManager,
    runtimeContext: {
      stateAccess,
      fieldAccess,
      featureAccess,
      actions,
    },
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
    capabilityRegistry: capabilityComposition.registry,
    capabilities: capabilityComposition.capabilities,
    storeId,
  };
}
