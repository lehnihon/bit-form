import { useCallback, useSyncExternalStore, useRef, useEffect } from "react";
import { useBitStore } from "./context";
import { getDeepValue, BitFieldConfig, BitPath, BitPathValue } from "../core";

export function useBitFieldBase<
  TValue = any,
  TForm extends object = any,
  P extends BitPath<TForm> = BitPath<TForm>,
>(path: P, config?: BitFieldConfig<TForm>) {
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
    if (config) {
      store.registerConfig(path, config as any);
    }

    return () => {
      if (store.unregisterField) {
        store.unregisterField(path);
      }
    };
  }, [store, path, config]);

  const getSnapshot = useCallback(() => {
    const state = store.getState();
    const value = getDeepValue(
      state.values,
      path as string,
    ) as BitPathValue<TForm, P>;
    const error = state.errors[path];
    const touched = !!state.touched[path];

    const isHidden = store.isHidden(path);
    const isRequired = store.isRequired(path);
    const isDirty = store.isFieldDirty(path);
    const isValidating = store.isFieldValidating(path);

    if (
      lastState.current &&
      lastState.current.value === value &&
      lastState.current.error === error &&
      lastState.current.touched === touched &&
      lastState.current.isHidden === isHidden &&
      lastState.current.isRequired === isRequired &&
      lastState.current.isDirty === isDirty &&
      lastState.current.isValidating === isValidating
    ) {
      return lastState.current;
    }

    const newState = {
      value,
      error,
      touched,
      isHidden,
      isRequired,
      isDirty,
      isValidating,
    };
    lastState.current = newState;
    return newState;
  }, [store, path]);

  const subscribe = useCallback(
    (cb: () => void) => store.subscribe(cb),
    [store],
  );

  const fieldState = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const setValue = useCallback(
    (val: BitPathValue<TForm, P>) => store.setField(path, val),
    [store, path],
  );

  const setBlur = useCallback(() => store.blurField(path), [store, path]);

  return { fieldState, setValue, setBlur, store };
}
