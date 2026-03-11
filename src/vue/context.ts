import { inject, provide, InjectionKey } from "vue";
import type { BitFrameworkStore } from "../core";

// Chave única para evitar colisões
export const BIT_STORE_KEY: InjectionKey<BitFrameworkStore<any>> =
  Symbol("BIT_STORE");

export function provideBitStore<T extends object>(store: BitFrameworkStore<T>) {
  provide(BIT_STORE_KEY, store);
}

export function useBitStore<T extends object>() {
  const store = inject(BIT_STORE_KEY);
  if (!store)
    throw new Error(
      "BitForm Vue hooks devem ser usados sob um provideBitStore",
    );
  return store as BitFrameworkStore<T>;
}
