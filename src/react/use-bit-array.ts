import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import {
  BitArrayPath,
  cleanupRegisteredPrefix,
  createArrayBinding,
} from "../core";
import { useBitStore } from "./context";

export function useBitArray<
  TForm extends object = any,
  P extends BitArrayPath<TForm> = BitArrayPath<TForm>,
>(path: P) {
  const store = useBitStore<TForm>();
  const controller = useMemo(
    () => createArrayBinding<TForm, P>(store, path),
    [store, path],
  );

  const getSnapshot = useCallback(() => {
    return controller.readItems();
  }, [controller]);

  const subscribeArray = useCallback(
    (cb: () => void) => store.observe.subscribePath(path, () => cb()),
    [store, path],
  );

  const data = useSyncExternalStore(subscribeArray, getSnapshot, getSnapshot);

  const fields = useMemo(() => controller.getFields(data), [controller, data]);

  useEffect(() => {
    return () => {
      cleanupRegisteredPrefix(store, `${path as string}.`);
    };
  }, [store, path]);

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
