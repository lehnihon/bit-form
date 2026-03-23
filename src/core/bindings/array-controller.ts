import { getDeepValue } from "../utils";
import type {
  BitArrayItem,
  BitArrayBindingApi,
  BitArrayPath,
  BitPath,
  BitPathValue,
} from "../public-types";

export interface BitArrayBindingField<TItem> {
  key: string;
  value: TItem;
  index: number;
}

export interface BitArrayBindingController<
  TForm extends object,
  P extends BitArrayPath<TForm>,
> {
  readItems(): BitArrayItem<BitPathValue<TForm, P>>[];
  getFields(
    items: BitArrayItem<BitPathValue<TForm, P>>[],
  ): BitArrayBindingField<BitArrayItem<BitPathValue<TForm, P>>>[];
  append(value: BitArrayItem<BitPathValue<TForm, P>>): void;
  prepend(value: BitArrayItem<BitPathValue<TForm, P>>): void;
  insert(index: number, value: BitArrayItem<BitPathValue<TForm, P>>): void;
  remove(index: number): void;
  move(from: number, to: number): void;
  swap(indexA: number, indexB: number): void;
  replace(items: BitArrayItem<BitPathValue<TForm, P>>[]): void;
  clear(): void;
}

export function createArrayBindingController<
  TForm extends object,
  P extends BitArrayPath<TForm>,
>(
  store: BitArrayBindingApi<TForm>,
  path: P,
): BitArrayBindingController<TForm, P> {
  type Item = BitArrayItem<BitPathValue<TForm, P>>;

  let ids: string[] = [];

  const createId = (index?: number) =>
    store.config.idFactory({
      scope: "array",
      path: path as string,
      index,
    });

  const normalizeItems = (value: unknown): Item[] =>
    Array.isArray(value) ? (value as Item[]) : [];

  const syncIds = (items: Item[]): Item[] => {
    if (items.length !== ids.length) {
      if (items.length > ids.length) {
        const diff = items.length - ids.length;
        ids = [
          ...ids,
          ...Array.from({ length: diff }, (_, offset) =>
            createId(ids.length + offset),
          ),
        ];
      } else {
        ids = ids.slice(0, items.length);
      }
    }

    return items;
  };

  return {
    readItems() {
      const value = getDeepValue(store.getState().values, path as string) as
        | BitPathValue<TForm, P>
        | undefined;
      return syncIds(normalizeItems(value));
    },

    getFields(items) {
      return items.map((item, index) => ({
        key: ids[index] || `temp-${index}`,
        value: item,
        index,
      }));
    },

    append(value) {
      ids = [...ids, createId(ids.length)];
      store.pushItem(path, value);
    },

    prepend(value) {
      ids = [createId(0), ...ids];
      store.prependItem(path, value);
    },

    insert(index, value) {
      const nextIds = [...ids];
      nextIds.splice(index, 0, createId(index));
      ids = nextIds;
      store.insertItem(path, index, value);
    },

    remove(index) {
      ids = ids.filter((_, currentIndex) => currentIndex !== index);
      store.removeItem(path, index);
    },

    move(from, to) {
      const nextIds = [...ids];
      const [item] = nextIds.splice(from, 1);
      nextIds.splice(to, 0, item);
      ids = nextIds;
      store.moveItem(path, from, to);
    },

    swap(indexA, indexB) {
      const nextIds = [...ids];
      [nextIds[indexA], nextIds[indexB]] = [nextIds[indexB], nextIds[indexA]];
      ids = nextIds;
      store.swapItems(path, indexA, indexB);
    },

    replace(items) {
      ids = items.map((_, index) => createId(index));
      store.setField(
        path as P & BitPath<TForm>,
        items as BitPathValue<TForm, P & BitPath<TForm>>,
      );
    },

    clear() {
      ids = [];
      store.setField(
        path as P & BitPath<TForm>,
        [] as BitPathValue<TForm, P & BitPath<TForm>>,
      );
    },
  };
}
