import { BitStore } from "../index";
import { BitConfig } from "../contracts/types";
import { BitStoreApi, BitStoreHooksApi } from "../contracts/public-types";

const HIDDEN_STORE_KEYS = new Set<string | symbol>([
  "subscribeSelector",
  "subscribePath",
  "getFieldState",
  "setFieldWithMeta",
  "markFieldsTouched",
  "registerCachedFieldIndexes",
  "unregisterCachedFieldIndexes",
  "invalidateFieldIndexes",
  "internalUpdateState",
  "internalSaveSnapshot",
  "batchStateUpdates",
  "flushBatchedStateUpdates",
]);

const storeFacadeRegistry = new WeakMap<object, BitStore<any>>();

export function resolveBitStoreForHooks<T extends object>(
  store: BitStoreApi<T> | BitStore<T>,
): BitStoreHooksApi<T> {
  if (store instanceof BitStore) {
    return store;
  }

  const resolvedEngine = storeFacadeRegistry.get(store as object);
  if (resolvedEngine) {
    return resolvedEngine as BitStoreHooksApi<T>;
  }

  throw new Error(
    "BitStore: store facade without engine reference cannot be resolved for hooks API.",
  );
}

export function createBitStore<T extends object = any>(
  config: BitConfig<T> = {},
): BitStoreApi<T> {
  const engine = new BitStore<T>(config);
  const facade = new Proxy(engine, {
    get(target, prop, receiver) {
      if (HIDDEN_STORE_KEYS.has(prop)) {
        return undefined;
      }

      const value = Reflect.get(target, prop, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
    has(_target, prop) {
      return !HIDDEN_STORE_KEYS.has(prop) && prop in engine;
    },
  }) as BitStoreApi<T>;

  storeFacadeRegistry.set(facade as object, engine);

  return facade;
}
