import { ref, computed, onUnmounted } from "vue";
import { useBitStore } from "./context";
import { getDeepValue } from "../core";

const generateId = () => Math.random().toString(36).substring(2, 9);

export function useBitFieldArray<T = any>(path: string) {
  const store = useBitStore();

  const getSnapshot = () => {
    const val = getDeepValue(store.getState().values, path);
    return Array.isArray(val) ? (val as T[]) : [];
  };

  const initialValues = getSnapshot();
  const values = ref<T[]>(initialValues) as { value: T[] };
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

  onUnmounted(unsubscribe);

  const fields = computed(() =>
    values.value.map((v, i) => ({
      key: ids.value[i] || generateId(),
      value: v,
      index: i,
    })),
  );

  return {
    fields,
    append: (val: T) => {
      ids.value.push(generateId());
      store.pushItem(path, val);
    },
    prepend: (val: T) => {
      ids.value.unshift(generateId());
      store.prependItem(path, val);
    },
    insert: (index: number, val: T) => {
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
  };
}
