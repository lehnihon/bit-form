import type { BitFormControllerStoreApi } from "./store/contracts/public/store-api-types";

export type BitFormDomEvent = {
  preventDefault?: () => void;
  stopPropagation?: () => void;
};

export interface BitFormControllerRuntime {
  clearSubmissionState: () => void;
  setSubmissionResult: (result: unknown) => void;
  setSubmissionError: (error: Error | null) => void;
}

export interface BitFormControllerOptions {
  stopPropagation?: boolean;
}

export function preventFormEvent(
  event?: BitFormDomEvent,
  options?: BitFormControllerOptions,
) {
  event?.preventDefault?.();
  if (options?.stopPropagation) {
    event?.stopPropagation?.();
  }
}

export function createFormController<T extends object>(
  store: BitFormControllerStoreApi<T>,
  runtime: BitFormControllerRuntime,
  options?: BitFormControllerOptions,
) {
  const submit = (
    onSuccess: (
      values: T,
      dirtyValues?: Partial<T>,
    ) => unknown | Promise<unknown>,
  ) => {
    return async (event?: BitFormDomEvent): Promise<void> => {
      preventFormEvent(event, options);
      await store.submit(onSuccess);
    };
  };

  const onSubmit = (
    handler: (values: T, dirtyValues?: Partial<T>) => Promise<unknown>,
  ) => {
    return async (event?: BitFormDomEvent): Promise<void> => {
      preventFormEvent(event, options);
      runtime.setSubmissionError(null);

      let submissionResult: unknown;
      const submitResult = await store.submit(async (values, dirtyValues) => {
        submissionResult = await handler(values, dirtyValues);
      });

      if (submitResult.status === "submitted") {
        runtime.setSubmissionResult(submissionResult);
        runtime.setSubmissionError(null);
        return;
      }

      if (submitResult.status === "failed") {
        runtime.setSubmissionError(
          submitResult.error instanceof Error
            ? submitResult.error
            : new Error(String(submitResult.error)),
        );
      }
    };
  };

  const reset = () => {
    store.reset();
    runtime.clearSubmissionState();
  };

  return {
    submit,
    onSubmit,
    reset,
    getValues: () => store.getState().values,
    getErrors: () => store.getState().errors,
    getTouched: () => store.getState().touched,
    getDirtyValues: () => store.getDirtyValues(),
  };
}
