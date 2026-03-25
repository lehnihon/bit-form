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

const frameworkAdapterCache = new WeakMap<object, unknown>();

const frameworkStoreMethodMap: {
  [K in keyof BitFrameworkStoreApi<any>]: true;
} = {
  subscribe: true,
  subscribePath: true,
  subscribeSelector: true,
  subscribeTracked: true,
  getFieldState: true,
  subscribeFieldState: true,
  setField: true,
  blurField: true,
  resolveMask: true,
  unregisterField: true,
  getState: true,
  subscribeFormMeta: true,
  submit: true,
  reset: true,
  validate: true,
  setError: true,
  setErrors: true,
  setServerErrors: true,
  setValues: true,
  transaction: true,
  registerField: true,
  unregisterPrefix: true,
  markFieldsTouched: true,
  getDirtyValues: true,
  pushItem: true,
  prependItem: true,
  insertItem: true,
  removeItem: true,
  moveItem: true,
  swapItems: true,
  replaceItems: true,
  clearItems: true,
  createArrayItemId: true,
  undo: true,
  redo: true,
  getHistoryMetadata: true,
  subscribeHistoryMeta: true,
  getPersistMetadata: true,
  restorePersisted: true,
  forceSave: true,
  clearPersisted: true,
  subscribePersistMeta: true,
  hasValidationsInProgress: true,
  getScopeFields: true,
  getScopeStatus: true,
  getScopeErrors: true,
  subscribeScopeStatus: true,
};

const frameworkStoreMethodKeys = Object.keys(frameworkStoreMethodMap) as Array<
  keyof BitFrameworkStoreApi<any>
>;

function bindFrameworkAdapter<T extends object>(
  store: BitFrameworkStoreApi<T>,
): BitFrameworkStoreApi<T> {
  const cacheKey = store as unknown as object;
  const cached = frameworkAdapterCache.get(cacheKey);

  if (cached) {
    return cached as BitFrameworkStoreApi<T>;
  }

  const adapter = {} as BitFrameworkStoreApi<T>;

  const assignDelegate = <TKey extends keyof BitFrameworkStoreApi<T>>(
    key: TKey,
  ): void => {
    adapter[key] = ((...args: unknown[]) => {
      const method = store[key] as unknown as (...args: unknown[]) => unknown;
      return method.call(store, ...args);
    }) as BitFrameworkStoreApi<T>[TKey];
  };

  for (const key of frameworkStoreMethodKeys) {
    assignDelegate(key as keyof BitFrameworkStoreApi<T>);
  }

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
