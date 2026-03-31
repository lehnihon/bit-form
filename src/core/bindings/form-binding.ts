import type {
  BitFormControllerOptions,
  BitFormControllerRuntime,
} from "../form-controller";
import { createFormController } from "../form-controller";
import type { BitStoreApi } from "../store/contracts/public/store-api-types";

export function createFrameworkFormBinding<T extends object>(
  store: BitStoreApi<T>,
  runtime: BitFormControllerRuntime,
  options?: BitFormControllerOptions,
) {
  const controllerStore = {
    getState: store.read.getState,
    getDirtyValues: store.read.getDirtyValues,
    submit: store.write.submit,
    reset: store.write.reset,
    setServerErrors: store.write.setServerErrors,
  };

  return {
    controller: createFormController(controllerStore, runtime, options),
    actions: {
      setField: store.write.setField.bind(store.write),
      blurField: store.write.blurField.bind(store.write),
      setValues: store.write.setValues.bind(store.write),
      setError: store.write.setError.bind(store.write),
      setErrors: store.write.setErrors.bind(store.write),
      setServerErrors: store.write.setServerErrors.bind(store.write),
      validate: store.feature.validate.bind(store.feature),
      transaction: store.write.transaction.bind(store.write),
    },
  };
}
