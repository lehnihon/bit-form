import {
  useCallback,
  useSyncExternalStore,
  useMemo,
  useRef,
  useState,
} from "react";
import { useBitStore } from "./context";
import { isValidationErrorShape, extractServerErrors } from "../core/utils";

export function useBitForm<T extends object>() {
  const store = useBitStore<T>();

  const [submitError, setSubmitError] = useState<Error | null>(null);
  const [lastResponse, setLastResponse] = useState<unknown>(null);

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
    (onSuccess: (values: T, dirtyValues: Partial<T>) => void | Promise<void>) => {
      return (e?: { preventDefault: () => void }) => {
        e?.preventDefault?.();
        return store.submit(onSuccess);
      };
    },
    [store],
  );

  const onSubmit = useCallback(
    (handler: (values: T, dirtyValues: Partial<T>) => Promise<unknown>) => {
      return (e?: { preventDefault: () => void }) => {
        e?.preventDefault?.();
        setSubmitError(null);

        return store.submit(async (values, dirtyValues) => {
          try {
            const result = await handler(values, dirtyValues);
            setLastResponse(result);
            setSubmitError(null);
          } catch (err) {
            if (isValidationErrorShape(err)) {
              store.setServerErrors(extractServerErrors(err));
            } else {
              setSubmitError(
                err instanceof Error ? err : new Error(String(err)),
              );
            }
          }
        });
      };
    },
    [store],
  );

  const reset = useCallback(() => {
    store.reset();
    setSubmitError(null);
    setLastResponse(null);
  }, [store]);

  const getValues = useCallback(() => store.getState().values, [store]);
  const getErrors = useCallback(() => store.getState().errors, [store]);
  const getTouched = useCallback(() => store.getState().touched, [store]);
  const getDirtyValues = useCallback(() => store.getDirtyValues(), [store]);

  const meta = useMemo(
    () => ({
      ...metaState,
      submitError,
      lastResponse,
    }),
    [metaState, submitError, lastResponse],
  );

  return {
    // Metadata (grouped)
    meta,
    // Getters
    getValues,
    getErrors,
    getTouched,
    getDirtyValues,
    // Main actions (frequent use - flat)
    submit,
    onSubmit,
    reset,
    setField: store.setField.bind(store),
    blurField: store.blurField.bind(store),
    setValues: store.setValues.bind(store),
    setError: store.setError.bind(store),
    setErrors: store.setErrors.bind(store),
    setServerErrors: store.setServerErrors.bind(store),
    validate: store.validate.bind(store),
    // Array mutations (grouped)
    mutations: {
      pushItem: store.pushItem.bind(store),
      removeItem: store.removeItem.bind(store),
      prependItem: store.prependItem.bind(store),
      insertItem: store.insertItem.bind(store),
      moveItem: store.moveItem.bind(store),
      swapItems: store.swapItems.bind(store),
    },
    // History (grouped)
    history: {
      undo: store.undo.bind(store),
      redo: store.redo.bind(store),
    },
  };
}
