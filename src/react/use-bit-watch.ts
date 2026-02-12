import { useCallback, useSyncExternalStore } from 'react';
import { useBitStore } from './context';

export function useBitWatch(path: string) {
  const store = useBitStore();

  const getSnapshot = useCallback(() => {
    const value = path.split('.').reduce((prev: any, curr) => prev?.[curr], store.getState().values);
    return value;
  }, [store, path]);

  // Retorna o valor atualizado do campo observado
  return useSyncExternalStore(
    store.subscribe.bind(store),
    getSnapshot,
    getSnapshot
  );
}