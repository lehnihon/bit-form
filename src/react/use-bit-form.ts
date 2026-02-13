import { useCallback, useSyncExternalStore, useMemo } from "react";
import { useBitStore } from "./context";

export function useBitForm<T extends object>() {
  const store = useBitStore<T>();
  const state = useSyncExternalStore(
    store.subscribe.bind(store),
    store.getState.bind(store),
    store.getState.bind(store),
  );

  const submit = useCallback(
    (onSuccess: (values: T) => void | Promise<void>) => {
      return (e?: { preventDefault: () => void }) => {
        e?.preventDefault?.();
        return store.submit(onSuccess);
      };
    },
    [store],
  );

  const actions = useMemo(
    () => ({
      setField: store.setField.bind(store),
      setValues: store.setValues.bind(store),
      setError: store.setError.bind(store),
      setErrors: store.setErrors.bind(store),
      reset: store.reset.bind(store),
      validate: store.validate.bind(store),
      registerMask: store.registerMask.bind(store),
      pushItem: store.pushItem.bind(store),
      removeItem: store.removeItem.bind(store),
      prependItem: store.prependItem.bind(store),
      insertItem: store.insertItem.bind(store),
      moveItem: store.moveItem.bind(store),
      swapItems: store.swapItems.bind(store),
    }),
    [store],
  );

  return {
    values: state.values,
    errors: state.errors,
    touched: state.touched,
    isValid: state.isValid,
    isDirty: state.isDirty,
    isSubmitting: state.isSubmitting,
    submit,
    ...actions,
    store,
  };
}
