import { useCallback, useSyncExternalStore, useMemo } from "react";
import { useBitStore } from "./context";
import { createArrayBindingController, BitArrayPath } from "../core";

export function useBitArray<
  TForm extends object = any,
  P extends BitArrayPath<TForm> = BitArrayPath<TForm>,
>(path: P) {
  const store = useBitStore<TForm>();
  const controller = useMemo(
    () => createArrayBindingController<TForm, P>(store, path),
    [store, path],
  );

  const getSnapshot = useCallback(() => {
    return controller.readItems();
  }, [controller]);

  const subscribeArray = useCallback(
    (cb: () => void) => store.subscribePath(path, () => cb()),
    [store, path],
  );

  const data = useSyncExternalStore(subscribeArray, getSnapshot, getSnapshot);

  const fields = useMemo(() => controller.getFields(data), [controller, data]);

  return {
    fields,
    length: data.length,
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
