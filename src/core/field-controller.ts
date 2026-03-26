import { formatMaskedValue, parseMaskedInput } from "./mask/field-binding";
import type { BitMask } from "./mask/types";
import type { BitFieldBindingApi } from "./store/contracts/public/store-api-types";
import type { BitPath, BitPathValue } from "./store/contracts/types";

export function createMaskedFieldController<
  TForm extends object,
  P extends BitPath<TForm>,
>(
  store: BitFieldBindingApi<TForm>,
  path: P,
  resolveMask: () => BitMask | undefined,
) {
  const setValue = (value: unknown) => {
    const mask = resolveMask();
    store.setField(
      path,
      parseMaskedInput(value, mask) as BitPathValue<TForm, P>,
    );
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
