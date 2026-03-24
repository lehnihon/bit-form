import { BitStore } from "../index";
import { BitConfig } from "../contracts/types";
import {
  BitFrameworkStoreApi,
  BitStoreApi,
  BitStoreHooksApi,
} from "../contracts/public-types";
import { BIT_FRAMEWORK_STORE_SYMBOL } from "./framework-store-brand";
import { BIT_HOOKS_API_SYMBOL } from "./hook-brand";

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
    return store as unknown as BitFrameworkStoreApi<T>;
  }

  if (isFrameworkBindingStore<T>(store)) {
    return store;
  }

  throw new Error(
    "BitForm: o store informado não expõe o contrato de binding esperado pelo framework adapter.",
  );
}

export function createBitStore<T extends object = any>(
  config: BitConfig<T> = {},
): BitStoreHooksApi<T> {
  return new BitStore<T>(config) as unknown as BitStoreHooksApi<T>;
}
