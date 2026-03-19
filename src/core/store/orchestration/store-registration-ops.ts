import type { BitFieldDefinition, BitState } from "../contracts/types";
import { BitFieldRegistry } from "../registry/field-registry";
import { BitSubscriptionEngine } from "../engines/subscription-engine";
import { buildFieldUnregisterPatch } from "../engines/store-field-cleanup-engine";
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

  if (fieldRegistry.isHidden(path)) {
    subscriptions.notify(state, [path]);
  }
}

export function unregisterStoreField<T extends object>(args: {
  path: string;
  state: BitState<T>;
  hasStaticConfig: boolean;
  fieldRegistry: BitFieldRegistry<T>;
  validationCleanupField: (path: string) => void;
  invalidateFieldIndexes: () => void;
  dispatch: (operation: BitStoreOperation<T>) => void;
}): void {
  const {
    path,
    state,
    hasStaticConfig,
    fieldRegistry,
    validationCleanupField,
    invalidateFieldIndexes,
    dispatch,
  } = args;

  if (hasStaticConfig) {
    return;
  }

  validationCleanupField(path);
  fieldRegistry.unregister(path);
  invalidateFieldIndexes();

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
  fieldRegistry: BitFieldRegistry<T>;
  validationCleanupPrefix: (prefix: string) => void;
  invalidateFieldIndexes: () => void;
}): void {
  const {
    prefix,
    fieldRegistry,
    validationCleanupPrefix,
    invalidateFieldIndexes,
  } = args;

  validationCleanupPrefix(prefix);
  fieldRegistry.unregisterPrefix(prefix);
  invalidateFieldIndexes();
}
