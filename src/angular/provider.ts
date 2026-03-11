import { inject, InjectionToken, Provider } from "@angular/core";
import type { BitFrameworkStore } from "../core";

export const BIT_STORE_TOKEN = new InjectionToken<BitFrameworkStore<any>>(
  "BIT_STORE",
);

export function provideBitStore<T extends object>(
  store: BitFrameworkStore<T>,
): Provider {
  return { provide: BIT_STORE_TOKEN, useValue: store };
}

export function useBitStore<T extends object>() {
  const store = inject(BIT_STORE_TOKEN, { optional: true });

  if (!store) {
    throw new Error(
      "BitForm: Não foi possível encontrar a BitStore. " +
        'Certifique-se de que você adicionou "provideBitStore(store)" nos providers do seu componente.',
    );
  }

  return store as BitFrameworkStore<T>;
}
