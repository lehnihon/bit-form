import { createMaskedFieldController } from "../field-controller";
import type { BitStoreApi } from "../store/contracts/public/store-api-types";
import type { BitPath, BitPathValue } from "../store/contracts/types";

export function createFrameworkMaskedFieldBinding<
  TForm extends object,
  P extends BitPath<TForm>,
>(store: BitStoreApi<TForm>, path: P) {
  const fieldStore = {
    setField<PPath extends BitPath<TForm>>(
      targetPath: PPath,
      value: BitPathValue<TForm, PPath>,
    ) {
      store.write.setField(targetPath, value);
    },
    blurField<PPath extends BitPath<TForm>>(targetPath: PPath) {
      store.write.blurField(targetPath);
    },
  };

  return {
    fieldController: createMaskedFieldController(fieldStore, path, () =>
      store.feature.resolveMask(path as string),
    ),
  };
}
