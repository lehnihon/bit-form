import { createInternalBitStore } from "../index";
import { BitConfig } from "../contracts/types";
import {
  BitArrayMutationBindingApi,
  BitDirtyTrackingBindingApi,
  BitFieldBindingApi,
  BitFieldRegistrationBindingApi,
  BitFormActionBindingApi,
  BitFormMetaBindingApi,
  BitFrameworkStoreApi,
  BitHistoryBindingApi,
  BitPersistBindingApi,
  BitScopeBindingApi,
  BitStoreSelectorBindingApi,
  BitStoreHooksApi,
} from "../contracts/public/store-api-types";
import { BIT_FRAMEWORK_STORE_SYMBOL } from "./framework-store-brand";
import { BIT_HOOKS_API_SYMBOL } from "./hook-brand";

const frameworkAdapterCache = new WeakMap<object, BitFrameworkStoreApi<any>>();

function createFrameworkStoreFromSlices<T extends object>(
  store: BitStoreHooksApi<T>,
): BitFrameworkStoreApi<T> {
  const { read, observe, write, feature } = store;
  const featureBindings = {
    registerField: feature.registerField,
    unregisterField: feature.unregisterField,
    unregisterPrefix: feature.unregisterPrefix,
    restorePersisted: feature.restorePersisted,
    forceSave: feature.forceSave,
    clearPersisted: feature.clearPersisted,
    pushItem: feature.pushItem,
    prependItem: feature.prependItem,
    insertItem: feature.insertItem,
    removeItem: feature.removeItem,
    moveItem: feature.moveItem,
    swapItems: feature.swapItems,
    replaceItems: feature.replaceItems,
    clearItems: feature.clearItems,
    undo: feature.undo,
    redo: feature.redo,
  };

  return {
    ...read,
    ...observe,
    ...write,
    ...featureBindings,
    resolveMask: store.resolveMask.bind(store),
    createArrayItemId: store.createArrayItemId.bind(store),
    hasValidationsInProgress: store.hasValidationsInProgress.bind(store),
    getScopeFields: store.getScopeFields.bind(store),
  };
}

function bindFrameworkAdapter<T extends object>(
  store: BitFrameworkStoreApi<T>,
): BitFrameworkStoreApi<T> {
  const cacheKey = store as object;
  const cached = frameworkAdapterCache.get(cacheKey);

  if (cached) {
    return cached as BitFrameworkStoreApi<T>;
  }

  const hooksLikeStore = store as unknown as BitStoreHooksApi<T>;

  const adapter =
    hooksLikeStore.read &&
    hooksLikeStore.observe &&
    hooksLikeStore.write &&
    hooksLikeStore.feature
      ? createFrameworkStoreFromSlices(hooksLikeStore)
      : store;

  const brandedAdapter = {
    [BIT_FRAMEWORK_STORE_SYMBOL]: true as const,
    ...adapter,
  } as BitFrameworkStoreApi<T>;

  frameworkAdapterCache.set(
    cacheKey,
    brandedAdapter as BitFrameworkStoreApi<any>,
  );
  frameworkAdapterCache.set(
    brandedAdapter as object,
    brandedAdapter as BitFrameworkStoreApi<any>,
  );

  return brandedAdapter;
}

function isHookCompatibleStore<T extends object>(
  store: unknown,
): store is BitStoreHooksApi<T> {
  if (!store || typeof store !== "object") {
    return false;
  }

  const candidate = store as Record<PropertyKey, unknown>;
  return candidate[BIT_HOOKS_API_SYMBOL] === true;
}

export function resolveBitStoreForHooks<T extends object>(
  store: unknown,
): BitStoreHooksApi<T> {
  if (isHookCompatibleStore(store)) {
    return store as unknown as BitStoreHooksApi<T>;
  }

  throw new Error(
    "BitForm: o store informado não expõe a API necessária para hooks/framework bindings.",
  );
}

function isFrameworkBindingStore<T extends object>(
  store: unknown,
): store is BitFrameworkStoreApi<T> {
  if (!store || typeof store !== "object") {
    return false;
  }

  const candidate = store as Record<PropertyKey, unknown>;
  return candidate[BIT_FRAMEWORK_STORE_SYMBOL] === true;
}

export function createFrameworkStoreAdapter<T extends object>(
  store: unknown,
): BitFrameworkStoreApi<T> {
  if (isHookCompatibleStore<T>(store)) {
    return bindFrameworkAdapter(store as unknown as BitFrameworkStoreApi<T>);
  }

  if (isFrameworkBindingStore<T>(store)) {
    return bindFrameworkAdapter(store);
  }

  throw new Error(
    "BitForm: o store informado não expõe o contrato de binding esperado pelo framework adapter.",
  );
}

export function createBitStore<T extends object = Record<string, unknown>>(
  config: BitConfig<T> = {},
): BitStoreHooksApi<T> {
  return createInternalBitStore<T>(config);
}
