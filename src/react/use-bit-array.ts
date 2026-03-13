import {
  useCallback,
  useSyncExternalStore,
  useState,
  useMemo,
  useEffect,
} from "react";
import { useBitStore } from "./context";
import {
  getDeepValue,
  BitArrayPath,
  BitPathValue,
  BitArrayItem,
  BitPath,
} from "../core";

const generateId = () => Math.random().toString(36).substring(2, 9);

export function useBitArray<
  TForm extends object = any,
  P extends BitArrayPath<TForm> = BitArrayPath<TForm>,
>(path: P) {
  const store = useBitStore<TForm>();

  type Item = BitArrayItem<BitPathValue<TForm, P>>;

  const getSnapshot = useCallback(() => {
    const state = store.getState();
    const value = getDeepValue(state.values, path as string) as
      | BitPathValue<TForm, P>
      | undefined;
    return Array.isArray(value) ? (value as Item[]) : [];
  }, [store, path]);

  const subscribeArray = useCallback(
    (cb: () => void) => store.subscribePath(path, () => cb()),
    [store, path],
  );

  const data = useSyncExternalStore(subscribeArray, getSnapshot, getSnapshot);

  const [ids, setIds] = useState<string[]>(() =>
    (data as Item[]).map(generateId),
  );

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
      append: (value: Item) => {
        setIds((prev) => [...prev, generateId()]);
        store.pushItem(path, value);
      },
      prepend: (value: Item) => {
        setIds((prev) => [generateId(), ...prev]);
        store.prependItem(path, value);
      },
      insert: (index: number, value: Item) => {
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
      replace: (items: Item[]) => {
        setIds(items.map(generateId));
        store.setField(
          path as unknown as BitPath<TForm>,
          items as unknown as BitPathValue<TForm, BitPath<TForm>>,
        );
      },
      clear: () => {
        setIds([]);
        store.setField(
          path as unknown as BitPath<TForm>,
          [] as unknown as BitPathValue<TForm, BitPath<TForm>>,
        );
      },
    }),
    [store, path],
  );

  const fields = useMemo(
    () =>
      (data as Item[]).map((item: Item, index: number) => ({
        key: ids[index] || `temp-${index}`,
        value: item,
        index,
      })),
    [data, ids],
  );

  return {
    fields,
    length: data.length,
    ...methods,
  };
}
