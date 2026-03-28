import { createInternalBitStore } from "../index";
import { BitConfig } from "../contracts/types";
import {
  BitStoreApi,
  BitFrameworkStoreApi,
  BitStoreHooksApi,
} from "../contracts/public/store-api-types";
import { BIT_FRAMEWORK_STORE_SYMBOL } from "./framework-store-brand";

const frameworkAdapterCache = new WeakMap<object, BitFrameworkStoreApi<any>>();

function defineAllProperties(
  target: Record<PropertyKey, unknown>,
  source: object,
): void {
  Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
}

function createFrameworkStoreFromSlices<T extends object>(
  store: BitStoreHooksApi<T>,
): BitFrameworkStoreApi<T> {
  const { read, observe, write, feature } = store;
  const adapter: Record<PropertyKey, unknown> = {};

  defineAllProperties(adapter, read);
  defineAllProperties(adapter, observe);
  defineAllProperties(adapter, write);
  defineAllProperties(adapter, feature);

  delete adapter.cleanup;

  Object.defineProperties(adapter, {
    resolveMask: {
      value: store.resolveMask.bind(store),
      enumerable: true,
      configurable: true,
      writable: true,
    },
    createArrayItemId: {
      value: store.createArrayItemId.bind(store),
      enumerable: true,
      configurable: true,
      writable: true,
    },
    hasValidationsInProgress: {
      value: store.hasValidationsInProgress.bind(store),
      enumerable: true,
      configurable: true,
      writable: true,
    },
    getScopeFields: {
      value: store.getScopeFields.bind(store),
      enumerable: true,
      configurable: true,
      writable: true,
    },
  });

  return adapter as unknown as BitFrameworkStoreApi<T>;
}

function bindFrameworkAdapter<T extends object>(
  store: unknown,
): BitFrameworkStoreApi<T> {
  const cacheKey = store as object;
  const cached = frameworkAdapterCache.get(cacheKey);

  if (cached) {
    return cached as BitFrameworkStoreApi<T>;
  }

  const adapter = isHookCompatibleStore<T>(store)
    ? createFrameworkStoreFromSlices(store)
    : (store as BitFrameworkStoreApi<T>);

  const brandedAdapter = {} as Record<PropertyKey, unknown>;
  Object.defineProperty(brandedAdapter, BIT_FRAMEWORK_STORE_SYMBOL, {
    value: true,
    enumerable: true,
    configurable: true,
    writable: false,
  });
  defineAllProperties(brandedAdapter, adapter as object);

  frameworkAdapterCache.set(
    cacheKey,
    brandedAdapter as unknown as BitFrameworkStoreApi<any>,
  );
  frameworkAdapterCache.set(
    brandedAdapter as object,
    brandedAdapter as unknown as BitFrameworkStoreApi<any>,
  );

  return brandedAdapter as unknown as BitFrameworkStoreApi<T>;
}

function isHookCompatibleStore<T extends object>(
  store: unknown,
): store is BitStoreHooksApi<T> {
  if (!store || typeof store !== "object") {
    return false;
  }

  const candidate = store as Record<PropertyKey, unknown>;
  const hasNamespaces =
    !!candidate.read &&
    !!candidate.observe &&
    !!candidate.write &&
    !!candidate.feature;

  const hasFrameworkHelpers =
    typeof candidate.resolveMask === "function" &&
    typeof candidate.createArrayItemId === "function" &&
    typeof candidate.hasValidationsInProgress === "function" &&
    typeof candidate.getScopeFields === "function";

  return hasNamespaces && hasFrameworkHelpers;
}

export function resolveBitStoreForHooks<T extends object>(
  store: unknown,
): BitStoreHooksApi<T> {
  if (isHookCompatibleStore<T>(store)) {
    return store;
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
    return bindFrameworkAdapter(store);
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
): BitStoreApi<T> {
  const internalStore = createInternalBitStore<T>(config);

  const namespacedStore: BitStoreHooksApi<T> = {
    read: internalStore.read,
    observe: internalStore.observe,
    write: internalStore.write,
    feature: internalStore.feature,
    resolveMask: internalStore.resolveMask.bind(internalStore),
    createArrayItemId: internalStore.createArrayItemId.bind(internalStore),
    hasValidationsInProgress:
      internalStore.hasValidationsInProgress.bind(internalStore),
    getScopeFields: internalStore.getScopeFields.bind(internalStore),
  };

  return namespacedStore;
}
