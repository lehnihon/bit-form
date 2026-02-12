import { useCallback, useSyncExternalStore } from 'react';
import { useBitStore } from './context';

export function useBitForm<T extends object>() {
  const store = useBitStore<T>();

  const state = useSyncExternalStore(
    store.subscribe.bind(store),
    () => store.getState(),
    () => store.getState()
  );

  const submit = useCallback((onSuccess: (values: T) => void | Promise<void>) => {
    return (e?: { preventDefault: () => void }) => {
      e?.preventDefault?.();
      return store.submit(onSuccess);
    };
  }, [store]);

  return {
    ...state,
    submit,
    setField: store.setField.bind(store),
    setValues: store.setValues.bind(store),
    reset: store.reset.bind(store),
    pushItem: store.pushItem.bind(store),
    removeItem: store.removeItem.bind(store),
    prependItem: store.prependItem.bind(store),
    insertItem: store.insertItem.bind(store),
    moveItem: store.moveItem.bind(store),
    swapItems: store.swapItems.bind(store)
  };
}