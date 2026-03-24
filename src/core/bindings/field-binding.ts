import { createMaskedFieldController } from "../field-controller";
import type { BitFieldBindingApi } from "../store/contracts/public-types";
import type { BitPath } from "../store/contracts/types";

export function createFrameworkMaskedFieldBinding<
  TForm extends object,
  P extends BitPath<TForm>,
>(store: BitFieldBindingApi<TForm>, path: P) {
  return {
    fieldController: createMaskedFieldController(store, path, () =>
      store.resolveMask(path as string),
    ),
  };
}
