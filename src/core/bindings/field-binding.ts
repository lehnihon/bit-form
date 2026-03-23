import { createMaskedFieldController } from "../field-controller";
import type { BitFieldBindingApi, BitPath } from "../public-types";

export function createFrameworkMaskedFieldBinding<
  TForm extends object,
  P extends BitPath<TForm>,
>(store: BitFieldBindingApi<TForm>, path: P) {
  const resolvedMask = store.resolveMask(path as string);

  return {
    resolvedMask,
    fieldController: createMaskedFieldController(store, path, resolvedMask),
  };
}
