import {
  useCallback,
  useSyncExternalStore,
  useMemo,
  useRef,
  useState,
} from "react";
import { useBitStore } from "./context";
import { createFrameworkFormBinding } from "../core/bindings/form-binding";
import { readFormMetaSnapshot, subscribeFormMetaSnapshot } from "../core";
import type { UseBitFormResult } from "./types";

export function useBitForm<T extends object>(): UseBitFormResult<T> {
  const store = useBitStore<T>();

  const [submitError, setSubmitError] = useState<Error | null>(null);
  const [lastResponse, setLastResponse] = useState<unknown>(null);
  const lastMeta = useRef<ReturnType<typeof readFormMetaSnapshot<T>> | null>(
    null,
  );

  const subscribeMeta = useCallback(
    (cb: () => void) => subscribeFormMetaSnapshot(store, cb),
    [store],
  );
  const getMetaSnapshot = useCallback(() => {
    const nextMeta = readFormMetaSnapshot(store);

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

  const metaState = useSyncExternalStore(
    subscribeMeta,
    getMetaSnapshot,
    getMetaSnapshot,
  );

  const binding = useMemo(
    () =>
      createFrameworkFormBinding(store, {
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

  const { controller, actions } = binding;

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
    ...actions,
  };
}
