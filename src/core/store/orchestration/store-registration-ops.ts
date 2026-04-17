import type { BitFieldDefinition, BitState } from "../contracts/types";
import {
  patchStateOperation,
  type BitStoreOperation,
} from "../engines/operation-engine";
import { buildFieldUnregisterPatch } from "../engines/store-field-cleanup-engine";
import { BitSubscriptionEngine } from "../engines/subscription-engine";
import { analyzeCyclicDependencies } from "../managers/core/computed-dependency-analyzer";
import { BitFieldRegistry } from "../registry/field-registry";
import { isPathWithinPrefix, normalizePathPrefix } from "../shared/path-prefix";
import { getScopeRegistrySubscriptionPath } from "../shared/scope-status";
import type { BitStoreStateReader } from "../shared/store-state-reader";

function hasValueDerivation<T extends object>(
  config?: BitFieldDefinition<T>,
): boolean {
  return !!(config?.computed || config?.normalize);
}

export function registerStoreField<T extends object>(args: {
  path: string;
  config: BitFieldDefinition<T>;
  state: BitState<T>;
  fieldRegistry: BitFieldRegistry<T>;
  subscriptions: BitSubscriptionEngine<T>;
  validationCleanupField: (path: string) => void;
  stateReader: BitStoreStateReader<T>;
  invalidateFieldIndexes: () => void;
  dispatch: (operation: BitStoreOperation<T>) => void;
  getState: () => BitState<T>;
  onUnhandledError: (error: unknown, source: string) => void;
}): void {
  const {
    path,
    config,
    state,
    fieldRegistry,
    subscriptions,
    validationCleanupField,
    stateReader,
    invalidateFieldIndexes,
    dispatch,
    getState,
    onUnhandledError,
  } = args;

  const previousConfig = fieldRegistry.getFieldConfig(path);
  const previousAsyncValidate = previousConfig?.validation?.asyncValidate;
  const nextAsyncValidate = config.validation?.asyncValidate;
  const previousAsyncValidateOn =
    previousConfig?.validation?.asyncValidateOn ?? "blur";
  const nextAsyncValidateOn = config.validation?.asyncValidateOn ?? "blur";
  const shouldCleanupAsyncState =
    !!previousConfig &&
    !!previousAsyncValidate &&
    (nextAsyncValidate !== previousAsyncValidate ||
      nextAsyncValidateOn !== previousAsyncValidateOn);

  if (shouldCleanupAsyncState) {
    validationCleanupField(path);
  }

  const shouldValidateComputedGraph = !!(
    previousConfig?.computed || config.computed
  );
  const shouldRecomputeValues =
    hasValueDerivation(previousConfig) || hasValueDerivation(config);

  fieldRegistry.register(path, config, state.values);
  invalidateFieldIndexes();

  if (shouldValidateComputedGraph) {
    const cycles = analyzeCyclicDependencies(
      fieldRegistry.getComputedEntries(state.values),
    );

    if (cycles.length > 0) {
      if (previousConfig) {
        fieldRegistry.register(path, previousConfig, state.values);
      } else {
        fieldRegistry.unregister(path);
      }

      invalidateFieldIndexes();
      subscriptions.invalidatePathExpansionCache(path);
      stateReader.invalidatePath(path);
      onUnhandledError(new Error(cycles[0].message), "computed");
      return;
    }
  }

  subscriptions.invalidatePathExpansionCache(path);
  stateReader.invalidatePath(path);

  if (shouldRecomputeValues) {
    dispatch(
      patchStateOperation(
        {
          values: state.values,
        },
        ["*"],
      ),
    );
  }

  const currentState = getState();

  if (config.scope) {
    subscriptions.notify(currentState, [
      getScopeRegistrySubscriptionPath(config.scope),
    ]);
  }

  if (fieldRegistry.isHidden(path)) {
    subscriptions.notify(currentState, [path]);
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
  subscriptions.invalidatePathExpansionCache(path);

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
  dispatch: (operation: BitStoreOperation<T>) => void;
  hasStaticConfigPath?: (path: string) => boolean;
}): void {
  const {
    prefix,
    state,
    fieldRegistry,
    subscriptions,
    validationCleanupPrefix,
    invalidateFieldIndexes,
    dispatch,
    hasStaticConfigPath,
  } = args;

  validationCleanupPrefix(prefix);

  const normalizedPrefix = normalizePathPrefix(prefix);
  const isStaticPath = hasStaticConfigPath ?? (() => false);
  const removablePaths: string[] = [];

  fieldRegistry.forEachFieldConfig((_config, path) => {
    if (!isPathWithinPrefix(path, normalizedPrefix)) {
      return;
    }

    if (isStaticPath(path)) {
      return;
    }

    removablePaths.push(path);
  });

  const removedEntries: [string, BitFieldDefinition<T>][] = [];
  removablePaths.forEach((path) => {
    const config = fieldRegistry.getFieldConfig(path);
    if (!config) {
      return;
    }

    fieldRegistry.unregister(path);
    removedEntries.push([path, config]);
  });

  invalidateFieldIndexes();
  subscriptions.invalidatePathExpansionCache(prefix);

  const impactedScopes = new Set(
    removedEntries
      .map(([, config]) => config.scope)
      .filter((scopeName): scopeName is string => !!scopeName),
  );

  impactedScopes.forEach((scopeName) => {
    subscriptions.notify(state, [getScopeRegistrySubscriptionPath(scopeName)]);
  });

  const nextErrors = { ...state.errors };
  const nextTouched = { ...state.touched };
  let changed = false;

  for (const [entryPath] of removedEntries) {
    if (nextErrors[entryPath as keyof typeof nextErrors]) {
      delete nextErrors[entryPath as keyof typeof nextErrors];
      changed = true;
    }
    if (nextTouched[entryPath as keyof typeof nextTouched]) {
      delete nextTouched[entryPath as keyof typeof nextTouched];
      changed = true;
    }
  }

  if (changed) {
    dispatch(patchStateOperation({ errors: nextErrors, touched: nextTouched }));
  }
}
