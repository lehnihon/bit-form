import { inject, InjectionToken, Provider } from "@angular/core";
import type { BitFormBindingApi } from "../core";
import { createFrameworkStoreAdapter } from "../core";

export const BIT_STORE_TOKEN = new InjectionToken<BitFormBindingApi<any>>(
  "BIT_STORE",
);

export function provideBitStore<T extends object>(store: unknown): Provider {
  return {
    provide: BIT_STORE_TOKEN,
    useValue: createFrameworkStoreAdapter<T>(store),
  };
}

export function useBitStore<T extends object>() {
  const store = inject(BIT_STORE_TOKEN, { optional: true });

  if (!store) {
    throw new Error(
      "BitForm: Não foi possível encontrar a BitStore. " +
        'Certifique-se de que você adicionou "provideBitStore(store)" nos providers do seu componente.',
    );
  }

  return store as BitFormBindingApi<T>;
}
