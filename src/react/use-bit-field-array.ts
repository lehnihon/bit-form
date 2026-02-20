import {
  useCallback,
  useSyncExternalStore,
  useState,
  useMemo,
  useEffect,
} from "react";
import { useBitStore } from "./context";
import { getDeepValue } from "../core";

const generateId = () => Math.random().toString(36).substring(2, 9);

export function useBitFieldArray<T = any>(path: string) {
  const store = useBitStore();

  const getSnapshot = useCallback(() => {
    const state = store.getState();
    const value = getDeepValue(state.values, path);
    return Array.isArray(value) ? value : [];
  }, [store, path]);

  const data = useSyncExternalStore(
    store.subscribe.bind(store),
    getSnapshot,
    getSnapshot,
  );

  const [ids, setIds] = useState<string[]>(() => data.map(generateId));

  useEffect(() => {
    if (data.length !== ids.length) {
      setIds((prevIds) => {
        if (data.length > prevIds.length) {
          const diff = data.length - prevIds.length;
          return [...prevIds, ...Array(diff).fill(null).map(generateId)];
        }
        return prevIds.slice(0, data.length);
      });
    }
  }, [data.length]);

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
      replace: (items: T[]) => {
        setIds(items.map(generateId));
        store.setField(path, items);
      },
      clear: () => {
        setIds([]);
        store.setField(path, []);
      },
    }),
    [store, path],
  );

  const fields = useMemo(
    () =>
      data.map((item: T, index: number) => ({
        key: ids[index] || `temp-${index}`,
        value: item,
        index,
      })),
    [data, ids],
  );

  return {
    fields,
    ...methods,
  };
}
