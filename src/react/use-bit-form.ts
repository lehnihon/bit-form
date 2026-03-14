import {
  useCallback,
  useSyncExternalStore,
  useMemo,
  useRef,
  useState,
} from "react";
import { useBitStore } from "./context";
import { createFormController } from "../core/form-controller";
import type { UseBitFormResult } from "./types";

export function useBitForm<T extends object>(): UseBitFormResult<T> {
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

  const controller = useMemo(
    () =>
      createFormController(store, {
        clearSubmissionState: () => {
          setSubmitError(null);
          setLastResponse(null);
        },
        setSubmissionResult: (result) => {
          setLastResponse(result);
        },
        setSubmissionError: (error) => {
          setSubmitError(error);
        },
      }),
    [store],
  );

  const submit = useCallback(controller.submit, [controller]);
  const onSubmit = useCallback(controller.onSubmit, [controller]);
  const reset = useCallback(controller.reset, [controller]);

  const getValues = useCallback(controller.getValues, [controller]);
  const getErrors = useCallback(controller.getErrors, [controller]);
  const getTouched = useCallback(controller.getTouched, [controller]);
  const getDirtyValues = useCallback(controller.getDirtyValues, [controller]);

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
  };
}
