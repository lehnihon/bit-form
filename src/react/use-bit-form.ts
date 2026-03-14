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
  } | null>(null);

  const getMetaSnapshot = useCallback(() => {
    const state = store.getState();
    const nextMeta = {
      isValid: state.isValid,
      isDirty: state.isDirty,
      isSubmitting: state.isSubmitting,
    };

    if (
      lastMeta.current &&
      lastMeta.current.isValid === nextMeta.isValid &&
      lastMeta.current.isDirty === nextMeta.isDirty &&
      lastMeta.current.isSubmitting === nextMeta.isSubmitting
    ) {
      return lastMeta.current;
    }

    lastMeta.current = nextMeta;
    return nextMeta;
  }, [store]);

  const subscribeMeta = useCallback(
    (cb: () => void) =>
      store.subscribeSelector(
        (state) => ({
          isValid: state.isValid,
          isDirty: state.isDirty,
          isSubmitting: state.isSubmitting,
        }),
        () => cb(),
      ),
    [store],
  );

  const metaState = useSyncExternalStore(
    subscribeMeta,
    getMetaSnapshot,
    getMetaSnapshot,
  );

  const submit = useCallback(
    (
      onSuccess: (values: T, dirtyValues?: Partial<T>) => void | Promise<void>,
    ) => {
      return (e?: { preventDefault: () => void }) => {
        e?.preventDefault?.();
        return store.submit(onSuccess);
      };
    },
    [store],
  );

  const onSubmit = useCallback(
    (handler: (values: T, dirtyValues?: Partial<T>) => Promise<unknown>) => {
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
    replaceValues: store.replaceValues.bind(store),
    hydrate: store.hydrate.bind(store),
    rebase: store.rebase.bind(store),
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
  };
}
