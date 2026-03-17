import { BitStore } from "../index";
import { BitConfig } from "../contracts/types";
import { BitStoreApi, BitStoreHooksApi } from "../contracts/public-types";

/**
 * Conjunto estático de chaves públicas de BitStoreApi + BitStoreHooksApi.
 * Usado pelo Proxy da façade para impedir acesso a métodos internos em runtime,
 * complementando a restrição de tipo em tempo de compilação.
 */
const PUBLIC_API_KEYS = new Set<string>([
  // BitStoreApi
  "config",
  "getConfig",
  "getState",
  "subscribe",
  "setField",
  "blurField",
  "replaceValues",
  "hydrate",
  "rebase",
  "setError",
  "setErrors",
  "setServerErrors",
  "validate",
  "reset",
  "transaction",
  "submit",
  "registerMask",
  "getDirtyValues",
  "getPersistMetadata",
  "restorePersisted",
  "forceSave",
  "clearPersisted",
  "cleanup",
  "registerField",
  "unregisterField",
  "isHidden",
  "isRequired",
  "isFieldDirty",
  "isFieldValidating",
  "watch",
  "pushItem",
  "prependItem",
  "insertItem",
  "removeItem",
  "moveItem",
  "swapItems",
  "getHistoryMetadata",
  "undo",
  "redo",
  "getStepStatus",
  "getStepErrors",
  // BitStoreHooksApi
  "getFieldState",
  "subscribePath",
  "subscribeSelector",
  "unregisterPrefix",
  "markFieldsTouched",
  "hasValidationsInProgress",
  "resolveMask",
  "getScopeFields",
]);

function createPublicFacade<T extends object>(
  store: BitStore<T>,
): BitStoreApi<T> {
  return new Proxy(store, {
    get(target, prop) {
      if (typeof prop === "string" && !PUBLIC_API_KEYS.has(prop)) {
        return undefined;
      }
      const value = Reflect.get(target, prop, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
    has(_target, prop) {
      return typeof prop === "string" && PUBLIC_API_KEYS.has(prop);
    },
    set() {
      return false;
    },
  }) as unknown as BitStoreApi<T>;
}

function isHookCompatibleStore<T extends object>(
  store: BitStoreApi<T> | BitStore<T>,
): store is BitStoreHooksApi<T> {
  return (
    typeof (store as Partial<BitStoreHooksApi<T>>).getFieldState ===
      "function" &&
    typeof (store as Partial<BitStoreHooksApi<T>>).subscribePath ===
      "function" &&
    typeof (store as Partial<BitStoreHooksApi<T>>).subscribeSelector ===
      "function" &&
    typeof (store as Partial<BitStoreHooksApi<T>>).markFieldsTouched ===
      "function" &&
    typeof (store as Partial<BitStoreHooksApi<T>>).hasValidationsInProgress ===
      "function" &&
    typeof (store as Partial<BitStoreHooksApi<T>>).resolveMask === "function" &&
    typeof (store as Partial<BitStoreHooksApi<T>>).getScopeFields === "function"
  );
}

export function resolveBitStoreForHooks<T extends object>(
  store: BitStoreApi<T> | BitStore<T>,
): BitStoreHooksApi<T> {
  if (store instanceof BitStore || isHookCompatibleStore(store)) {
    return store;
  }

  throw new Error(
    "BitForm: o store informado não expõe a API necessária para hooks/framework bindings.",
  );
}

export function createBitStore<T extends object = any>(
  config: BitConfig<T> = {},
): BitStoreApi<T> {
  return createPublicFacade(new BitStore<T>(config));
}
