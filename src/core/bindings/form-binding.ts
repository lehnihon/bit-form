import { createFormController } from "../form-controller";
import type { BitFormBindingApi } from "../public-types";
import type {
  BitFormControllerOptions,
  BitFormControllerRuntime,
} from "../form-controller";

export function createFrameworkFormBinding<T extends object>(
  store: BitFormBindingApi<T>,
  runtime: BitFormControllerRuntime,
  options?: BitFormControllerOptions,
) {
  const writeFacade = (store as BitFormBindingApi<T> & {
    writeFacade?: {
      setField: BitFormBindingApi<T>["setField"];
      blurField: BitFormBindingApi<T>["blurField"];
      setValues: BitFormBindingApi<T>["setValues"];
      setError: BitFormBindingApi<T>["setError"];
      setErrors: BitFormBindingApi<T>["setErrors"];
      setServerErrors: BitFormBindingApi<T>["setServerErrors"];
      validate: BitFormBindingApi<T>["validate"];
      transaction: BitFormBindingApi<T>["transaction"];
    };
  }).writeFacade;

  return {
    controller: createFormController(store, runtime, options),
    actions:
      writeFacade
        ? {
            setField: writeFacade.setField,
            blurField: writeFacade.blurField,
            setValues: writeFacade.setValues,
            setError: writeFacade.setError,
            setErrors: writeFacade.setErrors,
            setServerErrors: writeFacade.setServerErrors,
            validate: writeFacade.validate,
            transaction: writeFacade.transaction,
          }
        : {
            setField: store.setField.bind(store),
            blurField: store.blurField.bind(store),
            setValues: store.setValues.bind(store),
            setError: store.setError.bind(store),
            setErrors: store.setErrors.bind(store),
            setServerErrors: store.setServerErrors.bind(store),
            validate: store.validate.bind(store),
            transaction: store.transaction.bind(store),
          },
  };
}
