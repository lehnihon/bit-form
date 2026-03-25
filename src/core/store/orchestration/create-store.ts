import { createInternalBitStore } from "../index";
import { BitConfig } from "../contracts/types";
import {
  BitFrameworkStoreApi,
  BitStoreHooksApi,
} from "../contracts/public-types";
import { BIT_FRAMEWORK_STORE_SYMBOL } from "./framework-store-brand";
import { BIT_HOOKS_API_SYMBOL } from "./hook-brand";

const frameworkAdapterCache = new WeakMap<object, BitFrameworkStoreApi<any>>();

function bindFrameworkAdapter<T extends object>(
  store: BitFrameworkStoreApi<T>,
): BitFrameworkStoreApi<T> {
  const cacheKey = store as unknown as object;
  const cached = frameworkAdapterCache.get(cacheKey);

  if (cached) {
    return cached as BitFrameworkStoreApi<T>;
  }

  const delegate = <TKey extends keyof BitFrameworkStoreApi<T>>(
    key: TKey,
  ): BitFrameworkStoreApi<T>[TKey] => {
    return ((...args: unknown[]) => {
      const method = store[key] as unknown as (
        ...callArgs: unknown[]
      ) => unknown;
      return method.call(store, ...args);
    }) as BitFrameworkStoreApi<T>[TKey];
  };

  const adapter = {
    [BIT_FRAMEWORK_STORE_SYMBOL]: true,
    getState: delegate("getState"),
    subscribe: delegate("subscribe"),
    subscribePath: delegate("subscribePath"),
    subscribeSelector: delegate("subscribeSelector"),
    subscribeTracked: delegate("subscribeTracked"),
    getFieldState: delegate("getFieldState"),
    subscribeFieldState: delegate("subscribeFieldState"),
    setField: delegate("setField"),
    blurField: delegate("blurField"),
    resolveMask: delegate("resolveMask"),
    unregisterField: delegate("unregisterField"),
    subscribeFormMeta: delegate("subscribeFormMeta"),
    submit: delegate("submit"),
    reset: delegate("reset"),
    validate: delegate("validate"),
    setError: delegate("setError"),
    setErrors: delegate("setErrors"),
    setServerErrors: delegate("setServerErrors"),
    setValues: delegate("setValues"),
    transaction: delegate("transaction"),
    registerField: delegate("registerField"),
    unregisterPrefix: delegate("unregisterPrefix"),
    markFieldsTouched: delegate("markFieldsTouched"),
    getDirtyValues: delegate("getDirtyValues"),
    pushItem: delegate("pushItem"),
    prependItem: delegate("prependItem"),
    insertItem: delegate("insertItem"),
    removeItem: delegate("removeItem"),
    moveItem: delegate("moveItem"),
    swapItems: delegate("swapItems"),
    replaceItems: delegate("replaceItems"),
    clearItems: delegate("clearItems"),
    createArrayItemId: delegate("createArrayItemId"),
    undo: delegate("undo"),
    redo: delegate("redo"),
    getHistoryMetadata: delegate("getHistoryMetadata"),
    subscribeHistoryMeta: delegate("subscribeHistoryMeta"),
    getPersistMetadata: delegate("getPersistMetadata"),
    restorePersisted: delegate("restorePersisted"),
    forceSave: delegate("forceSave"),
    clearPersisted: delegate("clearPersisted"),
    subscribePersistMeta: delegate("subscribePersistMeta"),
    hasValidationsInProgress: delegate("hasValidationsInProgress"),
    getScopeFields: delegate("getScopeFields"),
    getScopeStatus: delegate("getScopeStatus"),
    getStepErrors: delegate("getStepErrors"),
    subscribeScopeStatus: delegate("subscribeScopeStatus"),
  } as BitFrameworkStoreApi<T>;

  frameworkAdapterCache.set(cacheKey, adapter);
  frameworkAdapterCache.set(adapter as unknown as object, adapter);

  return adapter;
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

export function createBitStore<T extends object = any>(
  config: BitConfig<T> = {},
): BitStoreHooksApi<T> {
  return createInternalBitStore<T>(config) as unknown as BitStoreHooksApi<T>;
}
