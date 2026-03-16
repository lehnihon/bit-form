import { useCallback, useSyncExternalStore, useRef, useMemo } from "react";
import { useBitStore } from "./context";
import {
  getDeepValue,
  BitArrayPath,
  BitPathValue,
  BitArrayItem,
  BitPath,
} from "../core";

export function useBitArray<
  TForm extends object = any,
  P extends BitArrayPath<TForm> = BitArrayPath<TForm>,
>(path: P) {
  const store = useBitStore<TForm>();
  const createId = useCallback(
    (index?: number) =>
      store.config.idFactory({
        scope: "array",
        path: path as string,
        index,
      }),
    [store, path],
  );
  const idsRef = useRef<string[]>([]);

  type Item = BitArrayItem<BitPathValue<TForm, P>>;

  const getSnapshot = useCallback(() => {
    const state = store.getState();
    const value = getDeepValue(state.values, path as string) as
      | BitPathValue<TForm, P>
      | undefined;
    const arrayValue = Array.isArray(value) ? (value as Item[]) : [];

    if (arrayValue.length !== idsRef.current.length) {
      if (arrayValue.length > idsRef.current.length) {
        const diff = arrayValue.length - idsRef.current.length;
        idsRef.current = [
          ...idsRef.current,
          ...Array(diff)
            .fill(null)
            .map((_, i) => createId(idsRef.current.length + i)),
        ];
      } else {
        idsRef.current = idsRef.current.slice(0, arrayValue.length);
      }
    }

    return arrayValue;
  }, [store, path, createId]);

  const subscribeArray = useCallback(
    (cb: () => void) => store.subscribePath(path, () => cb()),
    [store, path],
  );

  const data = useSyncExternalStore(subscribeArray, getSnapshot, getSnapshot);

  const methods = useMemo(
    () => ({
      append: (value: Item) => {
        idsRef.current = [...idsRef.current, createId(idsRef.current.length)];
        store.pushItem(path, value);
      },
      prepend: (value: Item) => {
        idsRef.current = [createId(0), ...idsRef.current];
        store.prependItem(path, value);
      },
      insert: (index: number, value: Item) => {
        const newIds = [...idsRef.current];
        newIds.splice(index, 0, createId(index));
        idsRef.current = newIds;
        store.insertItem(path, index, value);
      },
      remove: (index: number) => {
        idsRef.current = idsRef.current.filter((_, i) => i !== index);
        store.removeItem(path, index);
      },
      move: (from: number, to: number) => {
        const newIds = [...idsRef.current];
        const [item] = newIds.splice(from, 1);
        newIds.splice(to, 0, item);
        idsRef.current = newIds;
        store.moveItem(path, from, to);
      },
      swap: (indexA: number, indexB: number) => {
        const newIds = [...idsRef.current];
        [newIds[indexA], newIds[indexB]] = [newIds[indexB], newIds[indexA]];
        idsRef.current = newIds;
        store.swapItems(path, indexA, indexB);
      },
      replace: (items: Item[]) => {
        idsRef.current = items.map((_, index) => createId(index));
        store.setField(
          path as unknown as BitPath<TForm>,
          items as unknown as BitPathValue<TForm, BitPath<TForm>>,
        );
      },
      clear: () => {
        idsRef.current = [];
        store.setField(
          path as unknown as BitPath<TForm>,
          [] as unknown as BitPathValue<TForm, BitPath<TForm>>,
        );
      },
    }),
    [store, path, createId],
  );

  const fields = useMemo(
    () =>
      (data as Item[]).map((item: Item, index: number) => ({
        key: idsRef.current[index] || `temp-${index}`,
        value: item,
        index,
      })),
    [data],
  );

  return {
    fields,
    length: data.length,
    ...methods,
  };
}
