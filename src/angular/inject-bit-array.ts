import { DestroyRef, signal, computed, inject } from "@angular/core";
import { BIT_STORE_TOKEN } from "./provider";
import {
  createArrayBindingController,
  BitArrayPath,
  BitPathValue,
  BitArrayItem,
  cleanupRegisteredPrefix,
} from "../core";

export function injectBitArray<
  TForm extends object = any,
  P extends BitArrayPath<TForm> = BitArrayPath<TForm>,
>(path: P) {
  const store = inject(BIT_STORE_TOKEN);
  const destroyRef = inject(DestroyRef);
  const controller = createArrayBindingController<TForm, P>(store, path);

  const valuesSig = signal<BitArrayItem<BitPathValue<TForm, P>>[]>(
    controller.readItems(),
  );

  const unsub = store.subscribePath(path, () => {
    valuesSig.set(controller.readItems());
  });

  destroyRef.onDestroy(() => {
    unsub();
    cleanupRegisteredPrefix(store, `${path as string}.`);
  });

  return {
    fields: computed(() => controller.getFields(valuesSig())),
    length: computed(() => valuesSig().length),
    append: controller.append,
    prepend: controller.prepend,
    remove: controller.remove,
    insert: controller.insert,
    swap: controller.swap,
    move: controller.move,
    replace: controller.replace,
    clear: controller.clear,
  };
}
