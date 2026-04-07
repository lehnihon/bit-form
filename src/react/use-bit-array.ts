import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";
import {
  BitArrayPath,
  BitFrameworkStoreApi,
  BitStoreApi,
  cleanupRegisteredPrefix,
  createArrayBinding,
  valueEqual,
} from "../core";
import { resolveReactStore } from "./store";

export function useBitArray<
  TForm extends object = any,
  P extends BitArrayPath<TForm> = BitArrayPath<TForm>,
>(storeInput: BitFrameworkStoreApi<TForm> | BitStoreApi<TForm>, path: P) {
  const store = resolveReactStore(storeInput);
  const controller = useMemo(
    () => createArrayBinding<TForm, P>(store, path),
    [store, path],
  );
  type ArraySnapshot = ReturnType<typeof controller.readItems>;
  const lastSnapshotRef = useRef<ArraySnapshot | null>(null);

  const getSnapshot = useCallback(() => {
    const next = controller.readItems();

    if (lastSnapshotRef.current && valueEqual(lastSnapshotRef.current, next)) {
      return lastSnapshotRef.current;
    }

    lastSnapshotRef.current = next;
    return next;
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
