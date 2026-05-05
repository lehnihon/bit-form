import { createInternalBitStore } from "../index";
import { BitConfig } from "../contracts/types";
import {
  BitStoreApi,
  BitFrameworkStoreApi,
  BitStoreHooksApi,
} from "../contracts/public/store-api-types";
import { BIT_FRAMEWORK_STORE_SYMBOL } from "./framework-store-brand";
import { BIT_HOOKS_API_SYMBOL } from "./hook-brand";

function isHookCompatibleStore<T extends object>(
  store: unknown,
): store is BitStoreHooksApi<T> {
  if (!store || typeof store !== "object") {
    return false;
  }

  const candidate = store as Record<PropertyKey, unknown>;
  return (
    candidate[BIT_HOOKS_API_SYMBOL] === true &&
    !!candidate.read &&
    !!candidate.observe &&
    !!candidate.write &&
    !!candidate.feature
  );
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
  return (
    candidate[BIT_FRAMEWORK_STORE_SYMBOL] === true &&
    typeof (candidate as Record<PropertyKey, unknown>).read === "object" &&
    typeof (candidate as Record<PropertyKey, unknown>).feature === "object"
  );
}

export function createFrameworkStoreAdapter<T extends object>(
  store: unknown,
): BitFrameworkStoreApi<T> {
  if (!isHookCompatibleStore<T>(store)) {
    throw new Error(
      "BitForm: o store informado não possui branding de hooks (BIT_HOOKS_API_SYMBOL).",
    );
  }

  if (!isFrameworkBindingStore<T>(store)) {
    throw new Error(
      "BitForm: o store informado não possui branding de framework (BIT_FRAMEWORK_STORE_SYMBOL).",
    );
  }

  return store as BitFrameworkStoreApi<T>;
}

function applyStoreBranding<T extends object>(
  store: BitStoreApi<T>,
): BitStoreApi<T> {
  Object.defineProperty(store as object, BIT_HOOKS_API_SYMBOL, {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false,
  });

  Object.defineProperty(store as object, BIT_FRAMEWORK_STORE_SYMBOL, {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false,
  });

  return store;
}

export function createBitStore<T extends object = Record<string, unknown>>(
  config: BitConfig<T> = {},
): BitStoreApi<T> {
  const internalStore = createInternalBitStore<T>(config);

  const storeApi: BitStoreApi<T> = {
    read: internalStore.read,
    observe: internalStore.observe,
    write: internalStore.write,
    feature: internalStore.feature,
  };

  return applyStoreBranding(storeApi);
}
