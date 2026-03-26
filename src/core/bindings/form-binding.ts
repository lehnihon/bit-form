import { createFormController } from "../form-controller";
import type { BitFrameworkFormBindingApi } from "../store/contracts/public/store-api-types";
import type {
  BitFormControllerOptions,
  BitFormControllerRuntime,
} from "../form-controller";

export function createFrameworkFormBinding<T extends object>(
  store: BitFrameworkFormBindingApi<T>,
  runtime: BitFormControllerRuntime,
  options?: BitFormControllerOptions,
) {
  return {
    controller: createFormController(store, runtime, options),
    actions: {
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
