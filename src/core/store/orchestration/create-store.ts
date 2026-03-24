import { BitStore } from "../index";
import { BitConfig } from "../contracts/types";
import {
  BitFormBindingApi,
  BitStoreApi,
  BitStoreHooksApi,
} from "../contracts/public-types";
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
): store is BitFormBindingApi<T> {
  if (!store || typeof store !== "object") {
    return false;
  }

  const candidate = store as Record<string, unknown>;
  const requiredMethods: Array<keyof BitFormBindingApi<T>> = [
    "getFieldState",
    "subscribeFieldState",
    "getState",
    "subscribeFormMeta",
    "subscribe",
    "subscribePath",
    "subscribeSelector",
    "subscribeTracked",
    "setField",
    "blurField",
    "markFieldsTouched",
    "resolveMask",
    "submit",
    "reset",
    "validate",
    "setError",
    "setErrors",
    "setServerErrors",
    "setValues",
    "transaction",
    "pushItem",
    "prependItem",
    "insertItem",
    "removeItem",
    "moveItem",
    "swapItems",
    "replaceItems",
    "clearItems",
    "undo",
    "redo",
    "getHistoryMetadata",
    "getPersistMetadata",
    "restorePersisted",
    "forceSave",
    "clearPersisted",
    "getDirtyValues",
    "hasValidationsInProgress",
    "getScopeFields",
    "getScopeStatus",
    "getStepErrors",
    "subscribePersistMeta",
    "subscribeHistoryMeta",
    "subscribeScopeStatus",
    "createArrayItemId",
  ];

  return requiredMethods.every((methodName) => {
    return typeof candidate[methodName as string] === "function";
  });
}

export function createFrameworkStoreAdapter<T extends object>(
  store: unknown,
): BitFormBindingApi<T> {
  if (isHookCompatibleStore<T>(store)) {
    return store as unknown as BitFormBindingApi<T>;
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
