import { computed, onUnmounted, shallowRef } from "vue";
import {
  BitArrayPath,
  BitFrameworkStoreApi,
  BitStoreApi,
  cleanupRegisteredPrefix,
  createArrayBinding,
} from "../core";
import { resolveVueStore } from "./store";

export function useBitArray<
  TForm extends object = any,
  P extends BitArrayPath<TForm> = BitArrayPath<TForm>,
>(storeInput: BitFrameworkStoreApi<TForm> | BitStoreApi<TForm>, path: P) {
  const store = resolveVueStore(storeInput);
  const controller = createArrayBinding<TForm, P>(store, path);
  const values = shallowRef(controller.readItems());

  const unsubscribe = store.observe.subscribePath(path, () => {
    values.value = controller.readItems();
  });

  onUnmounted(() => {
    unsubscribe();
    cleanupRegisteredPrefix(store, `${path as string}.`);
  });

  const fields = computed(() => controller.getFields(values.value));

  const length = computed(() => values.value.length);

  return {
    fields,
    length,
    append: controller.append,
    prepend: controller.prepend,
    insert: controller.insert,
    remove: controller.remove,
    move: controller.move,
    swap: controller.swap,
    replace: controller.replace,
    clear: controller.clear,
  };
}
