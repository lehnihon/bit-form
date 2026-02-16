import { useCallback, useSyncExternalStore, useRef, useEffect } from "react";
import { useBitStore } from "./context";
import { getDeepValue, BitFieldConfig } from "../core";

export function useBitFieldBase<TValue = any, TForm extends object = any>(
  path: string,
  config?: BitFieldConfig<TForm>,
) {
  const store = useBitStore();
  const lastState = useRef<{
    value: TValue;
    error: any;
    touched: boolean;
    isHidden: boolean;
    isRequired: boolean;
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
    const value = getDeepValue(state.values, path) as TValue;
    const error = state.errors[path];
    const touched = !!state.touched[path];

    const isHidden = store.isHidden(path);
    const isRequired = store.isRequired(path);

    if (
      lastState.current &&
      lastState.current.value === value &&
      lastState.current.error === error &&
      lastState.current.touched === touched &&
      lastState.current.isHidden === isHidden &&
      lastState.current.isRequired === isRequired
    ) {
      return lastState.current;
    }

    const newState = { value, error, touched, isHidden, isRequired };
    lastState.current = newState;
    return newState;
  }, [store, path]);

  const subscribe = useCallback(
    (cb: () => void) => store.subscribe(cb),
    [store],
  );

  const fieldState = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const setValue = useCallback(
    (val: TValue) => store.setField(path, val),
    [store, path],
  );

  const setBlur = useCallback(() => store.blurField(path), [store, path]);

  return { fieldState, setValue, setBlur, store };
}
