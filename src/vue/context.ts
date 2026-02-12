import { inject, provide, InjectionKey } from 'vue';
import { BitStore } from '../core/bit-store';

// Chave única para evitar colisões
export const BIT_STORE_KEY: InjectionKey<BitStore<any>> = Symbol('BIT_STORE');

export function provideBitStore(store: BitStore<any>) {
  provide(BIT_STORE_KEY, store);
}

export function useBitStore<T extends object>() {
  const store = inject(BIT_STORE_KEY);
  if (!store) throw new Error('BitForm Vue hooks devem ser usados sob um provideBitStore');
  return store as BitStore<T>;
}