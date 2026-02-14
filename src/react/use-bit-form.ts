import { useCallback, useSyncExternalStore, useMemo, useRef } from "react";
import { useBitStore } from "./context";

export function useBitForm<T extends object>() {
  const store = useBitStore<T>();

  const lastMeta = useRef<{
    isValid: boolean;
    isDirty: boolean;
    isSubmitting: boolean;
    canUndo: boolean;
    canRedo: boolean;
  } | null>(null);

  const getMetaSnapshot = useCallback(() => {
    const state = store.getState();
    const { isValid, isDirty, isSubmitting } = state;
    const canUndo = store.canUndo;
    const canRedo = store.canRedo;

    if (
      lastMeta.current &&
      lastMeta.current.isValid === isValid &&
      lastMeta.current.isDirty === isDirty &&
      lastMeta.current.isSubmitting === isSubmitting &&
      lastMeta.current.canUndo === canUndo &&
      lastMeta.current.canRedo === canRedo
    ) {
      return lastMeta.current;
    }

    const nextMeta = { isValid, isDirty, isSubmitting, canUndo, canRedo };
    lastMeta.current = nextMeta;
    return nextMeta;
  }, [store]);

  const metaState = useSyncExternalStore(
    store.subscribe.bind(store),
    getMetaSnapshot,
    getMetaSnapshot,
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

  const getValues = useCallback(() => store.getState().values, [store]);
  const getErrors = useCallback(() => store.getState().errors, [store]);
  const getTouched = useCallback(() => store.getState().touched, [store]);

  const actions = useMemo(
    () => ({
      setField: store.setField.bind(store),
      blurField: store.blurField.bind(store),
      setValues: store.setValues.bind(store),
      setError: store.setError.bind(store),
      setErrors: store.setErrors.bind(store),
      setServerErrors: store.setServerErrors.bind(store),
      reset: store.reset.bind(store),
      validate: store.validate.bind(store),
      registerMask: store.registerMask.bind(store),
      pushItem: store.pushItem.bind(store),
      removeItem: store.removeItem.bind(store),
      prependItem: store.prependItem.bind(store),
      insertItem: store.insertItem.bind(store),
      moveItem: store.moveItem.bind(store),
      swapItems: store.swapItems.bind(store),
      undo: store.undo.bind(store),
      redo: store.redo.bind(store),
    }),
    [store],
  );

  return {
    ...metaState,
    getValues,
    getErrors,
    getTouched,
    submit,
    ...actions,
    store,
  };
}
