import { BitStore } from "../index";
import { BitConfig } from "../contracts/types";
import { BitStoreApi, BitStoreHooksApi } from "../contracts/public-types";

const BIT_STORE_ENGINE = Symbol.for("bit-form.store.engine");

const PUBLIC_FACADE_KEYS = new Set<string>([
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

type BitStoreFacade<T extends object> = BitStoreApi<T> & {
  [BIT_STORE_ENGINE]?: BitStore<T>;
};

export function resolveBitStoreForHooks<T extends object>(
  store: BitStoreApi<T> | BitStore<T>,
): BitStoreHooksApi<T> {
  if (store instanceof BitStore) {
    return store;
  }

  const facade = store as BitStoreFacade<T>;
  if (facade[BIT_STORE_ENGINE]) {
    return facade[BIT_STORE_ENGINE] as BitStoreHooksApi<T>;
  }

  throw new Error(
    "BitStore: store facade without engine reference cannot be resolved for hooks API.",
  );
}

export function createBitStore<T extends object = any>(
  config: BitConfig<T> = {},
): BitStoreApi<T> {
  const engine = new BitStore<T>(config);

  const facade = new Proxy(engine as BitStore<T>, {
    get(target, prop, receiver) {
      if (prop === BIT_STORE_ENGINE) {
        return engine;
      }

      if (typeof prop === "string" && !PUBLIC_FACADE_KEYS.has(prop)) {
        return undefined;
      }

      const value = Reflect.get(target, prop, receiver);
      if (typeof value === "function") {
        return value.bind(engine);
      }

      return value;
    },
    has(_target, prop) {
      if (prop === BIT_STORE_ENGINE) {
        return false;
      }

      if (typeof prop === "string") {
        return PUBLIC_FACADE_KEYS.has(prop);
      }

      return false;
    },
  }) as unknown as BitStoreFacade<T>;

  return facade as BitStoreApi<T>;
}
