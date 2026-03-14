import { useCallback, useSyncExternalStore, useRef, useEffect } from "react";
import { useBitStore } from "./context";
import { BitPath, BitPathValue } from "../core";

export function useBitFieldBase<
  TValue = any,
  TForm extends object = any,
  P extends BitPath<TForm> = BitPath<TForm>,
>(path: P) {
  const store = useBitStore<TForm>();
  const lastState = useRef<{
    value: BitPathValue<TForm, P>;
    error: any;
    touched: boolean;
    isHidden: boolean;
    isRequired: boolean;
    isDirty: boolean;
    isValidating: boolean;
  } | null>(null);

  useEffect(() => {
    return () => {
      if (store.unregisterField) {
        store.unregisterField(path);
      }
    };
  }, [store, path]);

  const getSnapshot = useCallback(() => {
    const nextState = store.getFieldState(path);

    if (
      lastState.current &&
      lastState.current.value === nextState.value &&
      lastState.current.error === nextState.error &&
      lastState.current.touched === nextState.touched &&
      lastState.current.isHidden === nextState.isHidden &&
      lastState.current.isRequired === nextState.isRequired &&
      lastState.current.isDirty === nextState.isDirty &&
      lastState.current.isValidating === nextState.isValidating
    ) {
      return lastState.current;
    }

    const newState = {
      value: nextState.value,
      error: nextState.error,
      touched: nextState.touched,
      isHidden: nextState.isHidden,
      isRequired: nextState.isRequired,
      isDirty: nextState.isDirty,
      isValidating: nextState.isValidating,
    };
    lastState.current = newState;
    return newState;
  }, [store, path]);

  const subscribe = useCallback(
    (cb: () => void) =>
      store.subscribeSelector(
        () => store.getFieldState(path),
        () => cb(),
        { paths: [path as string] },
      ),
    [store, path],
  );

  const fieldState = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const setValue = useCallback(
    (val: BitPathValue<TForm, P>) => store.setField(path, val),
    [store, path],
  );

  const setBlur = useCallback(() => store.blurField(path), [store, path]);

  return { fieldState, setValue, setBlur, store };
}
