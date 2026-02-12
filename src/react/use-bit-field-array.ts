import { useCallback, useSyncExternalStore, useState, useMemo, useEffect } from 'react';
import { useBitStore } from './context';

// Gerador de ID simples e rápido (sem dependência externa)
const generateId = () => Math.random().toString(36).substring(2, 9);

export function useBitFieldArray<T = any>(path: string) {
  const store = useBitStore();
  
  // Pegamos os dados reais da store
  const getSnapshot = useCallback(() => {
    const state = store.getState();
    const value = path.split('.').reduce((prev: any, curr) => prev?.[curr], state.values);
    return Array.isArray(value) ? value : [];
  }, [store, path]);

  const data = useSyncExternalStore(
    store.subscribe.bind(store),
    getSnapshot,
    getSnapshot
  );

  // Estado local para manter os IDs estáveis
  const [ids, setIds] = useState<string[]>(() => data.map(generateId));

  // Sincroniza os IDs se a store mudar externamente (ex: via setValues)
  useEffect(() => {
    if (data.length !== ids.length) {
      setIds(data.map(generateId));
    }
  }, [data.length]);

  // Métodos que manipulam a Store e os IDs simultaneamente
  const methods = useMemo(() => ({
    append: (value: T) => {
      setIds(prev => [...prev, generateId()]);
      store.pushItem(path, value);
    },
    prepend: (value: T) => {
      setIds(prev => [generateId(), ...prev]);
      store.prependItem(path, value);
    },
    remove: (index: number) => {
      setIds(prev => prev.filter((_, i) => i !== index));
      store.removeItem(path, index);
    },
    move: (from: number, to: number) => {
      setIds(prev => {
        const newIds = [...prev];
        const [item] = newIds.splice(from, 1);
        newIds.splice(to, 0, item);
        return newIds;
      });
      store.moveItem(path, from, to);
    },
    insert: (index: number, value: T) => {
      setIds(prev => {
        const newIds = [...prev];
        newIds.splice(index, 0, generateId());
        return newIds;
      });
      store.insertItem(path, index, value);
    },
    swap: (indexA: number, indexB: number) => {
      setIds(prev => {
        const newIds = [...prev];
        [newIds[indexA], newIds[indexB]] = [newIds[indexB], newIds[indexA]];
        return newIds;
      });
      store.swapItems(path, indexA, indexB);
    }
  }), [store, path]);

  // Montamos o array final para o map do usuário
  const fields = useMemo(() => 
    data.map((item, index) => ({
      id: ids[index] || generateId(), // Fallback de segurança
      value: item
    })), 
  [data, ids]);

  return {
    fields,
    ...methods
  };
}