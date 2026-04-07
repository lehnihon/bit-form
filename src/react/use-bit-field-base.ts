import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import {
  BitFieldSnapshot,
  BitFrameworkStoreApi,
  BitPath,
  BitPathValue,
  BitStoreApi,
  cleanupRegisteredField,
  createFieldStateSnapshot,
} from "../core";
import { resolveReactStore } from "./store";

export function useBitFieldBase<
  _TValue = any,
  TForm extends object = any,
  P extends BitPath<TForm> = BitPath<TForm>,
>(storeInput: BitFrameworkStoreApi<TForm> | BitStoreApi<TForm>, path: P) {
  const store = resolveReactStore(storeInput);
  const lastSnapshot = useRef<BitFieldSnapshot<BitPathValue<TForm, P>> | null>(
    null,
  );

  useEffect(() => {
    return () => cleanupRegisteredField(store, path as string);
  }, [store, path]);

  const getSnapshot = useCallback(() => {
    const nextState = store.read.getFieldState(path);
    const snapshot = createFieldStateSnapshot(nextState, lastSnapshot.current);
    lastSnapshot.current = snapshot;
    return snapshot;
  }, [store, path]);

  const subscribe = useCallback(
    (cb: () => void) => store.observe.subscribeFieldState(path, () => cb()),
    [store, path],
  );

  const fieldState = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const setValue = useCallback(
    (val: BitPathValue<TForm, P>) => store.write.setField(path, val),
    [store, path],
  );

  const setBlur = useCallback(() => store.write.blurField(path), [store, path]);

  return { fieldState, setValue, setBlur, store };
}
