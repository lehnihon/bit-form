import { DestroyRef, inject, InjectionToken, Provider } from "@angular/core";
import type { BitFrameworkStoreApi, BitStoreApi } from "../core";
import { createFrameworkStoreAdapter } from "../core";

export const BIT_STORE_TOKEN = new InjectionToken<BitFrameworkStoreApi<any>>(
  "BIT_STORE",
);

export function provideBitStore<T extends object>(
  store: BitFrameworkStoreApi<T> | BitStoreApi<T>,
): Provider {
  const adapted = createFrameworkStoreAdapter<T>(store);

  try {
    const destroyRef = inject(DestroyRef);
    destroyRef.onDestroy(() => {
      (adapted as any).feature?.cleanup?.();
    });
  } catch {
    // Called outside injection context (e.g., root module) — cleanup is
    // the caller's responsibility.
  }

  return {
    provide: BIT_STORE_TOKEN,
    useValue: adapted,
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

  return store as BitFrameworkStoreApi<T>;
}
