import { executeSubmitHandler } from "./submit-handler";
import type { BitFormBindingApi } from "./store/contracts/public-types";
import { resolveSegmentedBinding } from "./store/segmented-binding";

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
  const segmented = resolveSegmentedBinding(store);

  return {
    setField: <P extends Parameters<BitFormBindingApi<T>["setField"]>[0]>(
      path: P,
      value: Parameters<BitFormBindingApi<T>["setField"]>[1],
    ) => segmented.write.setField(path, value),
    blurField: <P extends Parameters<BitFormBindingApi<T>["blurField"]>[0]>(
      path: P,
    ) => segmented.write.blurField(path),
    setValues: (
      values: Parameters<BitFormBindingApi<T>["setValues"]>[0],
      options?: Parameters<BitFormBindingApi<T>["setValues"]>[1],
    ) => segmented.write.setValues(values, options),
    setError: (path: string, message: string | undefined) =>
      segmented.write.setError(path, message),
    setErrors: (errors: Parameters<BitFormBindingApi<T>["setErrors"]>[0]) =>
      segmented.write.setErrors(errors),
    setServerErrors: (
      serverErrors: Parameters<BitFormBindingApi<T>["setServerErrors"]>[0],
    ) => segmented.write.setServerErrors(serverErrors),
    validate: (options?: Parameters<BitFormBindingApi<T>["validate"]>[0]) =>
      segmented.write.validate(options),
    transaction: <TResult>(callback: () => TResult) =>
      segmented.write.transaction(callback),
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
  const segmented = resolveSegmentedBinding(store);

  const submit = (
    onSuccess: (values: T, dirtyValues?: Partial<T>) => void | Promise<void>,
  ) => {
    return (event?: BitFormDomEvent) => {
      preventFormEvent(event, options);
      return segmented.write.submit(onSuccess);
    };
  };

  const onSubmit = (
    handler: (values: T, dirtyValues?: Partial<T>) => Promise<unknown>,
  ) => {
    return (event?: BitFormDomEvent) => {
      preventFormEvent(event, options);
      runtime.setSubmissionError(null);

      return segmented.write.submit(async (values, dirtyValues) => {
        await executeSubmitHandler(handler, values, dirtyValues, {
          onSuccess: (result) => {
            runtime.setSubmissionResult(result);
            runtime.setSubmissionError(null);
          },
          onServerErrors: (serverErrors) => {
            segmented.write.setServerErrors(serverErrors);
          },
          onUnhandledError: (error) => {
            runtime.setSubmissionError(error);
          },
        });
      });
    };
  };

  const reset = () => {
    segmented.write.reset();
    runtime.clearSubmissionState();
  };

  return {
    submit,
    onSubmit,
    reset,
    getValues: () => segmented.query.getState().values,
    getErrors: () => segmented.query.getState().errors,
    getTouched: () => segmented.query.getState().touched,
    getDirtyValues: () => segmented.query.getDirtyValues(),
  };
}
