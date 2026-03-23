import { formatMaskedValue, parseMaskedInput } from "./mask/field-binding";
import type { BitMask } from "./mask/types";
import type { BitFieldBindingApi, BitFormBindingApi } from "./public-types";
import type { BitFieldState, BitPath, BitPathValue } from "./public-types";

export function subscribeFieldState<
  TForm extends object,
  P extends BitPath<TForm>,
>(
  store: BitFormBindingApi<TForm>,
  path: P,
  listener: (
    value: Readonly<BitFieldState<TForm, BitPathValue<TForm, P>>>,
  ) => void,
) {
  // Delegates to the native store method, which encapsulates the
  // path-scoping and structural equality check for single-field subscriptions.
  return store.subscribeFieldState(path, listener);
}

export function createMaskedFieldController<
  TForm extends object,
  P extends BitPath<TForm>,
>(store: BitFieldBindingApi<TForm>, path: P, mask: BitMask | undefined) {
  const setValue = (value: unknown) => {
    store.setField(
      path,
      parseMaskedInput(value, mask) as BitPathValue<TForm, P>,
    );
  };

  const setBlur = () => store.blurField(path);

  const displayValue = (value: unknown) => formatMaskedValue(value, mask);

  return {
    setValue,
    setBlur,
    displayValue,
  };
}
