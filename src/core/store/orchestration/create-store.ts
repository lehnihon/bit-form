import { BitStore } from "../index";
import { BitConfig } from "../contracts/types";
import { BitStoreApi, BitStoreHooksApi } from "../contracts/public-types";

/**
 * Conjunto estático de chaves públicas de BitStoreApi.
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
  "getMasksVersion",
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
]);

const facadeToInternalStore = new WeakMap<object, BitStore<any>>();

function createPublicFacade<T extends object>(
  store: BitStore<T>,
): BitStoreApi<T> {
  const facade = new Proxy(store, {
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

  facadeToInternalStore.set(facade as object, store);
  return facade;
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
  const internalStore = facadeToInternalStore.get(store as object);
  if (internalStore) {
    return internalStore as BitStoreHooksApi<T>;
  }

  if (store instanceof BitStore) {
    return store;
  }

  if (isHookCompatibleStore(store)) {
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
