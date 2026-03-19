import { BitStore } from "../index";
import { BitConfig } from "../contracts/types";
import { BitStoreApi, BitStoreHooksApi } from "../contracts/public-types";

function isHookCompatibleStore<T extends object>(
  store: unknown,
): store is BitStoreHooksApi<T> {
  if (!store || typeof store !== "object") {
    return false;
  }

  const candidate = store as Partial<BitStoreHooksApi<T>>;

  return (
    typeof candidate.getFieldState === "function" &&
    typeof candidate.subscribeFieldState === "function" &&
    typeof candidate.subscribeFormMeta === "function" &&
    typeof candidate.subscribePath === "function" &&
    typeof candidate.subscribeSelector === "function" &&
    typeof candidate.markFieldsTouched === "function" &&
    typeof candidate.hasValidationsInProgress === "function" &&
    typeof candidate.resolveMask === "function" &&
    typeof candidate.getScopeFields === "function"
  );
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

export function createBitStore<T extends object = any>(
  config: BitConfig<T> = {},
): BitStoreApi<T> {
  return new BitStore<T>(config) as unknown as BitStoreApi<T>;
}
