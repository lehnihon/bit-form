import { inject, onUnmounted, provide, InjectionKey } from "vue";
import type { BitFrameworkStoreApi, BitStoreApi } from "../core";
import { createFrameworkStoreAdapter } from "../core";

export const BIT_STORE_KEY: InjectionKey<BitFrameworkStoreApi<any>> =
  Symbol("BIT_STORE");

export function provideBitStore<T extends object>(
  store: BitFrameworkStoreApi<T> | BitStoreApi<T>,
) {
  const adapted = createFrameworkStoreAdapter<T>(store);
  provide(BIT_STORE_KEY, adapted);

  onUnmounted(() => {
    (adapted as any).feature?.cleanup?.();
  });
}

export function useBitStore<T extends object>() {
  const store = inject(BIT_STORE_KEY);
  if (!store)
    throw new Error(
      "BitForm Vue hooks devem ser usados sob um provideBitStore",
    );
  return store as BitFrameworkStoreApi<T>;
}
