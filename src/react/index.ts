import { useSyncExternalStore, useMemo } from 'react';
import { BitFormStore } from '../core/bit-store';

export function useBitField<T extends Record<string, any>, K extends keyof T>(
  store: BitFormStore<T>,
  fieldName: K
) {
  const value = useSyncExternalStore(
    (callback: () => void) => store.subscribe(callback), // Tipado explicitamente
    () => store.getState()[fieldName]
  );

  const error = useSyncExternalStore(
    (callback: () => void) => store.subscribe(callback), // Tipado explicitamente
    () => {
      const isTouched = store.getTouched()[fieldName];
      return isTouched ? store.getErrors()[fieldName] : undefined;
    }
  );

  // 2. Memorizamos as funções de callback para evitar re-renders desnecessários em componentes filhos
  return useMemo(() => ({
    value,
    error,
    setValue: (val: T[K]) => store.setState({ [fieldName]: val } as any),
    onBlur: () => store.markTouched(fieldName)
  }), [value, error, store, fieldName]);
}

/**
 * Hook para monitorar o status global (loading, dirty, etc)
 */
export function useBitFormStatus(store: BitFormStore<any>) {
  const isDirty = useSyncExternalStore(store.subscribe, () => store.isDirty());
  const isValidating = useSyncExternalStore(store.subscribe, () => store.isValidating);

  return {
    isDirty,
    isValidating,
    reset: () => store.reset(),
    getRawData: () => store.getRawState()
  };
}