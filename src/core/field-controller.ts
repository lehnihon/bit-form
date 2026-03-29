import { formatMaskedValue, parseMaskedInput } from "./mask/field-binding";
import type { BitMask } from "./mask/types";
import type { BitPath, BitPathValue } from "./store/contracts/types";

type BitMaskedFieldControllerStore<TForm extends object> = {
  setField(path: BitPath<TForm>, value: unknown): void;
  blurField(path: BitPath<TForm>): void;
};

export function createMaskedFieldController<
  TForm extends object,
  P extends BitPath<TForm>,
>(
  store: BitMaskedFieldControllerStore<TForm>,
  path: P,
  resolveMask: () => BitMask | undefined,
) {
  const setValue = (value: unknown) => {
    const mask = resolveMask();
    store.setField(path, parseMaskedInput(value, mask));
  };

  const setBlur = () => store.blurField(path);

  const displayValue = (value: unknown) =>
    formatMaskedValue(value, resolveMask());

  return {
    setValue,
    setBlur,
    displayValue,
  };
}
