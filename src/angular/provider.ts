import { inject, InjectionToken, Provider } from "@angular/core";
import type { BitStoreApi } from "../core";
import type { BitStoreHooksApi } from "../core/store/public-types";
import { resolveBitStoreForHooks } from "../core/store/create-store";

export const BIT_STORE_TOKEN = new InjectionToken<BitStoreHooksApi<any>>(
  "BIT_STORE",
);

export function provideBitStore<T extends object>(
  store: BitStoreApi<T>,
): Provider {
  return { provide: BIT_STORE_TOKEN, useValue: resolveBitStoreForHooks(store) };
}

export function useBitStore<T extends object>() {
  const store = inject(BIT_STORE_TOKEN, { optional: true });

  if (!store) {
    throw new Error(
      "BitForm: Não foi possível encontrar a BitStore. " +
        'Certifique-se de que você adicionou "provideBitStore(store)" nos providers do seu componente.',
    );
  }

  return store as BitStoreHooksApi<T>;
}
