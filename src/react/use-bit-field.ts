import { useCallback, useSyncExternalStore, useRef } from 'react';
import { useBitStore } from './context';

export function useBitField<T = any>(path: string) {
  const store = useBitStore();
  const lastState = useRef<any>(null);

  const getSnapshot = useCallback(() => {
    const state = store.getState();
    const value = path.split('.').reduce((p: any, c) => p?.[c], state.values);
    const error = state.errors[path];
    const touched = !!state.touched[path];

    if (
      lastState.current &&
      lastState.current.value === value &&
      lastState.current.error === error &&
      lastState.current.touched === touched
    ) {
      return lastState.current;
    }

    const newState = { value, error, touched };
    lastState.current = newState;
    return newState;
  }, [store, path]);

  const fieldState = useSyncExternalStore(
    store.subscribe.bind(store),
    getSnapshot,
    getSnapshot
  );

  const setValue = useCallback((val: T) => store.setField(path, val), [store, path]);
  const setBlur = useCallback(() => store.blurField(path), [store, path]);

  return {
    value: fieldState.value as T,
    error: fieldState.touched ? fieldState.error : undefined,
    touched: fieldState.touched,
    invalid: !!(fieldState.touched && fieldState.error),
    setValue,
    setBlur,
    props: {
      value: fieldState.value ?? '',
      onChange: (e: any) => setValue(e?.target ? e.target.value : e),
      onBlur: setBlur
    },
    mobileProps: {
      value: fieldState.value != null ? String(fieldState.value) : '',
      onChangeText: setValue,
      onBlur: setBlur
    }
  };
}