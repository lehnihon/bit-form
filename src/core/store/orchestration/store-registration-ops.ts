import type { BitFieldDefinition, BitState } from "../contracts/types";
import { BitFieldRegistry } from "../registry/field-registry";
import { BitSubscriptionEngine } from "../engines/subscription-engine";
import { buildFieldUnregisterPatch } from "../engines/store-field-cleanup-engine";
import { getScopeRegistrySubscriptionPath } from "../shared/scope-status";
import {
  patchStateOperation,
  type BitStoreOperation,
} from "../engines/operation-engine";

export function registerStoreField<T extends object>(args: {
  path: string;
  config: BitFieldDefinition<T>;
  state: BitState<T>;
  fieldRegistry: BitFieldRegistry<T>;
  subscriptions: BitSubscriptionEngine<T>;
  invalidateFieldIndexes: () => void;
}): void {
  const {
    path,
    config,
    state,
    fieldRegistry,
    subscriptions,
    invalidateFieldIndexes,
  } = args;

  fieldRegistry.register(path, config, state.values);
  invalidateFieldIndexes();

  if (config.scope) {
    subscriptions.notify(state, [
      getScopeRegistrySubscriptionPath(config.scope),
    ]);
  }

  if (fieldRegistry.isHidden(path)) {
    subscriptions.notify(state, [path]);
  }
}

export function unregisterStoreField<T extends object>(args: {
  path: string;
  state: BitState<T>;
  hasStaticConfig: boolean;
  fieldRegistry: BitFieldRegistry<T>;
  subscriptions: BitSubscriptionEngine<T>;
  validationCleanupField: (path: string) => void;
  invalidateFieldIndexes: () => void;
  dispatch: (operation: BitStoreOperation<T>) => void;
}): void {
  const {
    path,
    state,
    hasStaticConfig,
    fieldRegistry,
    subscriptions,
    validationCleanupField,
    invalidateFieldIndexes,
    dispatch,
  } = args;

  if (hasStaticConfig) {
    return;
  }

  const fieldConfig = fieldRegistry.getFieldConfig(path);
  validationCleanupField(path);
  fieldRegistry.unregister(path);
  invalidateFieldIndexes();

  if (fieldConfig?.scope) {
    subscriptions.notify(state, [
      getScopeRegistrySubscriptionPath(fieldConfig.scope),
    ]);
  }

  const cleanupPatch = buildFieldUnregisterPatch({ state, path });

  if (!cleanupPatch) {
    return;
  }

  dispatch(
    patchStateOperation({
      errors: cleanupPatch.errors,
      touched: cleanupPatch.touched,
    }),
  );
}

export function unregisterStorePrefix<T extends object>(args: {
  prefix: string;
  state: BitState<T>;
  fieldRegistry: BitFieldRegistry<T>;
  subscriptions: BitSubscriptionEngine<T>;
  validationCleanupPrefix: (prefix: string) => void;
  invalidateFieldIndexes: () => void;
}): void {
  const {
    prefix,
    state,
    fieldRegistry,
    subscriptions,
    validationCleanupPrefix,
    invalidateFieldIndexes,
  } = args;

  validationCleanupPrefix(prefix);
  const removedEntries = fieldRegistry.unregisterPrefix(prefix);
  invalidateFieldIndexes();

  const impactedScopes = new Set(
    removedEntries
      .map(([, config]) => config.scope)
      .filter((scopeName): scopeName is string => !!scopeName),
  );

  impactedScopes.forEach((scopeName) => {
    subscriptions.notify(state, [getScopeRegistrySubscriptionPath(scopeName)]);
  });
}
