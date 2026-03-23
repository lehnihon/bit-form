import {
  createFormController,
  createStoreFormActions,
} from "../form-controller";
import type { BitFormBindingApi } from "../store/contracts/public-types";
import type {
  BitFormControllerOptions,
  BitFormControllerRuntime,
} from "../form-controller";

export function createFrameworkFormBinding<T extends object>(
  store: BitFormBindingApi<T>,
  runtime: BitFormControllerRuntime,
  options?: BitFormControllerOptions,
) {
  return {
    controller: createFormController(store, runtime, options),
    actions: createStoreFormActions(store),
  };
}
