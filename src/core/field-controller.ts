import { formatMaskedValue, parseMaskedInput } from "./mask/field-binding";
import type { BitMask } from "./mask/types";
import type { BitFormBindingApi } from "./store/contracts/public-types";
import { resolveSegmentedBinding } from "./store/segmented-binding";
import type {
  BitFieldState,
  BitPath,
  BitPathValue,
} from "./store/contracts/types";

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
  const segmented = resolveSegmentedBinding(store);

  // Delegates to the native store method, which encapsulates the
  // path-scoping and structural equality check for single-field subscriptions.
  return segmented.observe.subscribeFieldState(path, listener);
}

export function createMaskedFieldController<
  TForm extends object,
  P extends BitPath<TForm>,
>(store: BitFormBindingApi<TForm>, path: P, mask: BitMask | undefined) {
  const segmented = resolveSegmentedBinding(store);

  const setValue = (value: unknown) => {
    segmented.write.setField(
      path,
      parseMaskedInput(value, mask) as BitPathValue<TForm, P>,
    );
  };

  const setBlur = () => segmented.write.blurField(path);

  const displayValue = (value: unknown) => formatMaskedValue(value, mask);

  return {
    setValue,
    setBlur,
    displayValue,
  };
}
