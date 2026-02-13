import { inject, InjectionToken, Provider } from "@angular/core"; // IMPORTANTE: Adicione o 'inject' aqui
import { BitStore } from "../core/store";

export const BIT_STORE_TOKEN = new InjectionToken<BitStore<any>>("BIT_STORE");

export function provideBitStore(store: BitStore<any>): Provider {
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

  return store as BitStore<T>;
}
