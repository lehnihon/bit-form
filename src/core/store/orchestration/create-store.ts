import { BitStore } from "../index";
import { BitConfig } from "../contracts/types";
import { BitStoreApi, BitStoreHooksApi } from "../contracts/public-types";

const PUBLIC_STORE_KEYS = new Set<string | symbol>([
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
]);

export function resolveBitStoreForHooks<T extends object>(
  store: BitStoreApi<T> | BitStore<T>,
): BitStoreHooksApi<T> {
  if (store instanceof BitStore) {
    return store;
  }

  throw new Error(
    "BitStore: store facade without engine reference cannot be resolved for hooks API.",
  );
}

export function createBitStore<T extends object = any>(
  config: BitConfig<T> = {},
): BitStoreApi<T> {
  const engine = new BitStore<T>(config);

  return new Proxy(engine, {
    get(target, prop, receiver) {
      if (!PUBLIC_STORE_KEYS.has(prop)) {
        return undefined;
      }

      const value = Reflect.get(target, prop, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
    has(_target, prop) {
      return PUBLIC_STORE_KEYS.has(prop);
    },
    ownKeys() {
      return Array.from(PUBLIC_STORE_KEYS) as Array<string | symbol>;
    },
    getOwnPropertyDescriptor(target, prop) {
      if (!PUBLIC_STORE_KEYS.has(prop)) {
        return undefined;
      }

      const descriptor = Reflect.getOwnPropertyDescriptor(target, prop);
      if (descriptor) {
        return descriptor;
      }

      return {
        configurable: true,
        enumerable: true,
        writable: false,
        value: Reflect.get(target, prop, target),
      };
    },
  }) as BitStoreApi<T>;
}
