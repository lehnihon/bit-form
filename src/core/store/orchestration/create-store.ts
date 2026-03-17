import { BitStore } from "../index";
import { BitConfig } from "../contracts/types";
import { BitStoreApi, BitStoreHooksApi } from "../contracts/public-types";

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
  return new BitStore<T>(config);
}
