import { executeSubmitHandler } from "./submit-handler";
import type { BitFormBindingApi } from "./store/contracts/public-types";

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

export function createStoreFormActions<T extends object>(
  store: BitFormBindingApi<T>,
) {
  return {
    setField: <P extends Parameters<BitFormBindingApi<T>["setField"]>[0]>(
      path: P,
      value: Parameters<BitFormBindingApi<T>["setField"]>[1],
    ) => store.setField(path, value),
    blurField: <P extends Parameters<BitFormBindingApi<T>["blurField"]>[0]>(
      path: P,
    ) => store.blurField(path),
    setValues: (
      values: Parameters<BitFormBindingApi<T>["setValues"]>[0],
      options?: Parameters<BitFormBindingApi<T>["setValues"]>[1],
    ) => store.setValues(values, options),
    setError: (path: string, message: string | undefined) =>
      store.setError(path, message),
    setErrors: (errors: Parameters<BitFormBindingApi<T>["setErrors"]>[0]) =>
      store.setErrors(errors),
    setServerErrors: (
      serverErrors: Parameters<BitFormBindingApi<T>["setServerErrors"]>[0],
    ) => store.setServerErrors(serverErrors),
    validate: (options?: Parameters<BitFormBindingApi<T>["validate"]>[0]) =>
      store.validate(options),
    transaction: <TResult>(callback: () => TResult) =>
      store.transaction(callback),
  };
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
  store: BitFormBindingApi<T>,
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
