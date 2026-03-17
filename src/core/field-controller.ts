import { formatMaskedValue, parseMaskedInput } from "./mask/field-binding";
import type { BitMask } from "./mask/types";
import type { BitStoreHooksApi } from "./store/contracts/public-types";
import type {
  BitFieldState,
  BitPath,
  BitPathValue,
} from "./store/contracts/types";

export function subscribeFieldState<
  TForm extends object,
  P extends BitPath<TForm>,
>(
  store: BitStoreHooksApi<TForm>,
  path: P,
  listener: (
    value: Readonly<BitFieldState<TForm, BitPathValue<TForm, P>>>,
  ) => void,
) {
  return store.subscribeSelector(
    () =>
      store.getFieldState(path) as Readonly<
        BitFieldState<TForm, BitPathValue<TForm, P>>
      >,
    listener,
    {
      paths: [path as string],
      autoTrackPaths: false,
      equalityFn: (prev, next) =>
        prev.value === next.value &&
        prev.error === next.error &&
        prev.touched === next.touched &&
        prev.isHidden === next.isHidden &&
        prev.isRequired === next.isRequired &&
        prev.isDirty === next.isDirty &&
        prev.isValidating === next.isValidating,
    },
  );
}

export function createMaskedFieldController<
  TForm extends object,
  P extends BitPath<TForm>,
>(store: BitStoreHooksApi<TForm>, path: P, mask: BitMask | undefined) {
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
