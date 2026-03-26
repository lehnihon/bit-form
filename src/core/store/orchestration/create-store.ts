import { createInternalBitStore } from "../index";
import { BitConfig } from "../contracts/types";
import {
  BitStoreApi,
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

const frameworkAdapterCache = new WeakMap<object, unknown>();

function createFrameworkStoreFromSlices<T extends object>(
  store: BitStoreHooksApi<T>,
): BitFrameworkStoreApi<T> {
  const read = store.read ?? store.slices.read;
  const observe = store.observe ?? store.slices.observe;
  const write = store.write ?? store.slices.write;
  const feature = store.feature ?? store.slices.feature;

  return {
    getState: read.getState,
    subscribe: observe.subscribe,
    subscribePath: observe.subscribePath,
    subscribeSelector: observe.subscribeSelector,
    subscribeTracked: observe.subscribeTracked,
    getFieldState: read.getFieldState,
    subscribeFieldState: observe.subscribeFieldState,
    setField: write.setField,
    blurField: write.blurField,
    resolveMask: store.resolveMask.bind(store),
    unregisterField: feature.unregisterField,
    subscribeFormMeta: observe.subscribeFormMeta,
    submit: write.submit,
    reset: write.reset,
    validate: write.validate,
    setError: write.setError,
    setErrors: write.setErrors,
    setServerErrors: write.setServerErrors,
    setValues: write.setValues,
    transaction: write.transaction,
    registerField: feature.registerField,
    unregisterPrefix: feature.unregisterPrefix,
    markFieldsTouched: write.markFieldsTouched,
    getDirtyValues: read.getDirtyValues,
    pushItem: feature.pushItem,
    prependItem: feature.prependItem,
    insertItem: feature.insertItem,
    removeItem: feature.removeItem,
    moveItem: feature.moveItem,
    swapItems: feature.swapItems,
    replaceItems: feature.replaceItems,
    clearItems: feature.clearItems,
    createArrayItemId: store.createArrayItemId.bind(store),
    undo: feature.undo,
    redo: feature.redo,
    getHistoryMetadata: read.getHistoryMetadata,
    subscribeHistoryMeta: observe.subscribeHistoryMeta,
    getPersistMetadata: read.getPersistMetadata,
    restorePersisted: feature.restorePersisted,
    forceSave: feature.forceSave,
    clearPersisted: feature.clearPersisted,
    subscribePersistMeta: observe.subscribePersistMeta,
    hasValidationsInProgress: store.hasValidationsInProgress.bind(store),
    getScopeFields: store.getScopeFields.bind(store),
    getScopeStatus: read.getScopeStatus,
    getScopeErrors: read.getScopeErrors,
    subscribeScopeStatus: observe.subscribeScopeStatus,
  };
}

function bindFrameworkAdapter<T extends object>(
  store: BitFrameworkStoreApi<T>,
): BitFrameworkStoreApi<T> {
  const cacheKey = store as unknown as object;
  const cached = frameworkAdapterCache.get(cacheKey);

  if (cached) {
    return cached as BitFrameworkStoreApi<T>;
  }

  const hooksLikeStore = store as unknown as BitStoreHooksApi<T> &
    Partial<BitStoreApi<T>>;

  const adapter =
    hooksLikeStore.read &&
    hooksLikeStore.observe &&
    hooksLikeStore.write &&
    hooksLikeStore.feature
      ? createFrameworkStoreFromSlices(hooksLikeStore)
      : hooksLikeStore.slices
        ? createFrameworkStoreFromSlices(hooksLikeStore)
        : store;

  const brandedAdapter = {
    [BIT_FRAMEWORK_STORE_SYMBOL]: true as const,
    ...adapter,
  };

  frameworkAdapterCache.set(cacheKey, brandedAdapter);
  frameworkAdapterCache.set(
    brandedAdapter as unknown as object,
    brandedAdapter,
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
