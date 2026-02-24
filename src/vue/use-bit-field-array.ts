import { ref, computed, onUnmounted } from "vue";
import { useBitStore } from "./context";
import {
  getDeepValue,
  BitArrayPath,
  BitPathValue,
  BitArrayItem,
  BitPath,
} from "../core";

const generateId = () => Math.random().toString(36).substring(2, 9);

export function useBitFieldArray<
  TForm extends object = any,
  P extends BitArrayPath<TForm> = BitArrayPath<TForm>,
>(path: P) {
  const store = useBitStore<TForm>();

  type Item = BitArrayItem<BitPathValue<TForm, P>>;

  const getSnapshot = (): Item[] => {
    const val = getDeepValue(
      store.getState().values,
      path as string,
    ) as BitPathValue<TForm, P> | undefined;
    return Array.isArray(val) ? (val as Item[]) : [];
  };

  const initialValues = getSnapshot();
  const values = ref<Item[]>(initialValues);
  const ids = ref<string[]>(initialValues.map(generateId));

  const unsubscribe = store.subscribe(() => {
    const newValues = getSnapshot();
    values.value = [...newValues];

    if (newValues.length !== ids.value.length) {
      const currentIds = [...ids.value];
      if (newValues.length > currentIds.length) {
        const diff = newValues.length - currentIds.length;
        const newIds = Array.from({ length: diff }, generateId);
        ids.value = [...currentIds, ...newIds];
      } else {
        ids.value = currentIds.slice(0, newValues.length);
      }
    }
  });

  onUnmounted(() => {
    unsubscribe();
    if (store.unregisterPrefix) {
      store.unregisterPrefix(`${path as string}.`);
    }
  });

  const fields = computed(() =>
    values.value.map((v, i) => ({
      key: ids.value[i] || `temp-${i}`,
      value: v,
      index: i,
    })),
  );

  return {
    fields,
    append: (val: Item) => {
      ids.value.push(generateId());
      store.pushItem(path, val);
    },
    prepend: (val: Item) => {
      ids.value.unshift(generateId());
      store.prependItem(path, val);
    },
    insert: (index: number, val: Item) => {
      ids.value.splice(index, 0, generateId());
      store.insertItem(path, index, val);
    },
    remove: (index: number) => {
      ids.value.splice(index, 1);
      store.removeItem(path, index);
    },
    move: (from: number, to: number) => {
      const currentIds = [...ids.value];
      const [id] = currentIds.splice(from, 1);
      currentIds.splice(to, 0, id);
      ids.value = currentIds;
      store.moveItem(path, from, to);
    },
    swap: (a: number, b: number) => {
      const currentIds = [...ids.value];
      [currentIds[a], currentIds[b]] = [currentIds[b], currentIds[a]];
      ids.value = currentIds;
      store.swapItems(path, a, b);
    },
    replace: (items: Item[]) => {
      ids.value = items.map(generateId);
      store.setField(path as unknown as BitPath<TForm>, items as any);
    },
    clear: () => {
      ids.value = [];
      store.setField(path as unknown as BitPath<TForm>, [] as any);
    },
  };
}
