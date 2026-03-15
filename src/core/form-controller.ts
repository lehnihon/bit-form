import { executeSubmitHandler } from "./submit-handler";
import type { BitStoreHooksApi } from "./store/contracts/public-types";

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
  store: BitStoreHooksApi<T>,
  runtime: BitFormControllerRuntime,
  options?: BitFormControllerOptions,
) {
  const submit = (
    onSuccess: (values: T, dirtyValues?: Partial<T>) => void | Promise<void>,
  ) => {
    return (event?: BitFormDomEvent) => {
      preventFormEvent(event, options);
      return store.submit(onSuccess);
    };
  };

  const onSubmit = (
    handler: (values: T, dirtyValues?: Partial<T>) => Promise<unknown>,
  ) => {
    return (event?: BitFormDomEvent) => {
      preventFormEvent(event, options);
      runtime.setSubmissionError(null);

      return store.submit(async (values, dirtyValues) => {
        await executeSubmitHandler(handler, values, dirtyValues, {
          onSuccess: (result) => {
            runtime.setSubmissionResult(result);
            runtime.setSubmissionError(null);
          },
          onServerErrors: (serverErrors) => {
            store.setServerErrors(serverErrors);
          },
          onUnhandledError: (error) => {
            runtime.setSubmissionError(error);
          },
        });
      });
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
