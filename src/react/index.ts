import { useSyncExternalStore, useCallback } from 'react';
import { BitStore } from '../core/bit-store';

export function useBitField<T extends object>(store: BitStore<T>, path: string) {
  const getSnapshot = useCallback(() => {
    const state = store.getState();
    return path.split('.').reduce((prev: any, curr) => prev?.[curr], state.values);
  }, [store, path]);

  const getErrorSnapshot = useCallback(() => {
    return store.getState().errors[path];
  }, [store, path]);

  const getTouchedSnapshot = useCallback(() => {
    return !!store.getState().touched[path];
  }, [store, path]);

  const value = useSyncExternalStore(
    store.subscribe.bind(store),
    getSnapshot,
    getSnapshot
  );

  const error = useSyncExternalStore(
    store.subscribe.bind(store),
    getErrorSnapshot,
    getErrorSnapshot
  );

  const touched = useSyncExternalStore(
    store.subscribe.bind(store),
    getTouchedSnapshot,
    getTouchedSnapshot
  );

  const setValue = useCallback((newValue: any) => {
    store.setField(path, newValue);
  }, [store, path]);

  const setBlur = useCallback(() => {
    store.blurField(path);
  }, [store, path]);

  return {
    value,
    error: touched ? error : undefined,
    touched,
    setValue,
    setBlur,
    props: {
      value: value ?? '',
      onChange: (e: any) => {
        const val = e?.target ? e.target.value : e;
        setValue(val);
      },
      onBlur: setBlur
    }
  };
}

export function useBitForm<T extends object>(store: BitStore<T>) {
  const getFullState = useCallback(() => store.getState(), [store]);

  const state = useSyncExternalStore(
    store.subscribe.bind(store),
    getFullState,
    getFullState
  );

  const submit = useCallback((onSuccess: (values: T) => void | Promise<void>) => {
    return (e?: { preventDefault: () => void }) => {
      if (e?.preventDefault) e.preventDefault();
      return store.submit(onSuccess);
    };
  }, [store]);

  return { 
    isValid: state.isValid,
    isSubmitting: state.isSubmitting,
    values: state.values,
    errors: state.errors,
    touched: state.touched,
    pushItem: store.pushItem.bind(store),
    removeItem: store.removeItem.bind(store),
    setField: store.setField.bind(store),
    submit
  };
}