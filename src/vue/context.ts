import { inject, provide, InjectionKey } from "vue";
import type { BitStoreApi } from "../core";

// Chave única para evitar colisões
export const BIT_STORE_KEY: InjectionKey<BitStoreApi<any>> =
  Symbol("BIT_STORE");

export function provideBitStore<T extends object>(store: BitStoreApi<T>) {
  provide(BIT_STORE_KEY, store);
}

export function useBitStore<T extends object>() {
  const store = inject(BIT_STORE_KEY);
  if (!store)
    throw new Error(
      "BitForm Vue hooks devem ser usados sob um provideBitStore",
    );
  return store as BitStoreApi<T>;
}
