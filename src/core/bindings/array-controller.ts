import type { BitStoreApi } from "../store/contracts/public/store-api-types";
import type {
  BitArrayItem,
  BitArrayPath,
  BitPathValue,
} from "../store/contracts/types";
import type { BitArrayBinding, BitArrayBindingField } from "../types/bindings";
import { getDeepValue } from "../utils";

export type { BitArrayBinding, BitArrayBindingField };

export function createArrayBinding<
  TForm extends object,
  P extends BitArrayPath<TForm>,
>(store: BitStoreApi<TForm>, path: P): BitArrayBinding<TForm, P> {
  type Item = BitArrayItem<BitPathValue<TForm, P>>;

  const normalizeItems = (value: unknown): Item[] =>
    Array.isArray(value) ? (value as Item[]) : [];

  const getIds = (length: number) =>
    store.feature.getArrayItemIds(path, length);

  return {
    readItems() {
      const value = getDeepValue(
        store.read.getState().values,
        path as string,
      ) as BitPathValue<TForm, P> | undefined;
      return normalizeItems(value);
    },

    getFields(items) {
      const ids = getIds(items.length);
      return items.map((item, index) => ({
        key: ids[index] || `temp-${index}`,
        value: item,
        index,
      }));
    },

    append(value) {
      store.feature.pushItem(path, value);
    },

    prepend(value) {
      store.feature.prependItem(path, value);
    },

    insert(index, value) {
      store.feature.insertItem(path, index, value);
    },

    remove(index) {
      store.feature.removeItem(path, index);
    },

    move(from, to) {
      store.feature.moveItem(path, from, to);
    },

    swap(indexA, indexB) {
      store.feature.swapItems(path, indexA, indexB);
    },

    replace(items) {
      store.feature.replaceItems(path, items);
    },

    clear() {
      store.feature.clearItems(path);
    },
  };
}
