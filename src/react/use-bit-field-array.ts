import {
  useCallback,
  useSyncExternalStore,
  useState,
  useMemo,
  useEffect,
} from "react";
import { useBitStore } from "./context";

// Gerador de ID simples e rápido (gera string aleatória tipo "abc1234")
const generateId = () => Math.random().toString(36).substring(2, 9);

export function useBitFieldArray<T = any>(path: string) {
  const store = useBitStore();

  // 1. Snapshot: Pega o array atual da store com segurança
  const getSnapshot = useCallback(() => {
    const state = store.getState();
    // Navega profundamente no objeto (ex: "users.0.skills")
    const value = path
      .split(".")
      .reduce((prev: any, curr) => prev?.[curr], state.values);

    return Array.isArray(value) ? value : [];
  }, [store, path]);

  const data = useSyncExternalStore(
    store.subscribe.bind(store),
    getSnapshot,
    getSnapshot,
  );

  // 2. IDs Estáveis: Mantemos IDs locais para usar nas 'keys' do React
  // Inicializamos lazy para evitar processamento desnecessário
  const [ids, setIds] = useState<string[]>(() => data.map(generateId));

  // 3. Sincronização Externa: Se a store mudar por fora (ex: reset ou load API)
  // ajustamos a quantidade de IDs para bater com os dados.
  useEffect(() => {
    if (data.length !== ids.length) {
      setIds((prevIds) => {
        if (data.length > prevIds.length) {
          // Array cresceu externamente: criar novos IDs
          const newIds = Array(data.length - prevIds.length)
            .fill(null)
            .map(generateId);
          return [...prevIds, ...newIds];
        } else {
          // Array diminuiu externamente: cortar IDs excedentes
          return prevIds.slice(0, data.length);
        }
      });
    }
  }, [data.length]); // Dependência apenas no tamanho para performance

  // 4. Métodos de Mutação (Otimistic Update)
  // Atualizamos os IDs locais IMEDIATAMENTE antes da store para evitar flash de tela
  const methods = useMemo(
    () => ({
      append: (value: T) => {
        setIds((prev) => [...prev, generateId()]);
        store.pushItem(path, value);
      },
      prepend: (value: T) => {
        setIds((prev) => [generateId(), ...prev]);
        store.prependItem(path, value);
      },
      insert: (index: number, value: T) => {
        setIds((prev) => {
          const newIds = [...prev];
          newIds.splice(index, 0, generateId());
          return newIds;
        });
        store.insertItem(path, index, value);
      },
      remove: (index: number) => {
        setIds((prev) => prev.filter((_, i) => i !== index));
        store.removeItem(path, index);
      },
      move: (from: number, to: number) => {
        setIds((prev) => {
          const newIds = [...prev];
          const [item] = newIds.splice(from, 1);
          newIds.splice(to, 0, item);
          return newIds;
        });
        store.moveItem(path, from, to);
      },
      swap: (indexA: number, indexB: number) => {
        setIds((prev) => {
          const newIds = [...prev];
          [newIds[indexA], newIds[indexB]] = [newIds[indexB], newIds[indexA]];
          return newIds;
        });
        store.swapItems(path, indexA, indexB);
      },
    }),
    [store, path],
  );

  // 5. Montagem do Resultado Final
  // Combinamos dados + IDs para o usuário renderizar listas com key={field.key}
  const fields = useMemo(
    () =>
      data.map((item: T, index: number) => ({
        key: ids[index] || generateId(), // Key estável para o React
        value: item,
        index, // Útil para passar no remove(index)
      })),
    [data, ids],
  );

  return {
    fields,
    ...methods,
  };
}
