import { inject, provide, InjectionKey } from "vue";
import type { BitFrameworkStoreApi } from "../core";
import { createFrameworkStoreAdapter } from "../core";

// Chave única para evitar colisões
export const BIT_STORE_KEY: InjectionKey<BitFrameworkStoreApi<any>> =
  Symbol("BIT_STORE");

export function provideBitStore<T extends object>(store: unknown) {
  provide(BIT_STORE_KEY, createFrameworkStoreAdapter<T>(store));
}

export function useBitStore<T extends object>() {
  const store = inject(BIT_STORE_KEY);
  if (!store)
    throw new Error(
      "BitForm Vue hooks devem ser usados sob um provideBitStore",
    );
  return store as BitFrameworkStoreApi<T>;
}
