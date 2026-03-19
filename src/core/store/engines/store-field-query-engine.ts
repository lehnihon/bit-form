import type { BitMask, BitMaskName } from "../../mask/types";
import type {
  BitErrors,
  BitFieldDefinition,
  BitFieldState,
  BitPath,
  BitPathValue,
  BitState,
} from "../contracts/types";

export function resolveFieldMask<T extends object>(args: {
  path: string;
  getFieldConfig: (path: string) => BitFieldDefinition<T> | undefined;
  masks: Record<BitMaskName, BitMask> | undefined;
}): BitMask | undefined {
  const { path, getFieldConfig, masks } = args;
  const maskOption = getFieldConfig(path)?.mask;

  if (!maskOption) {
    return undefined;
  }

  if (typeof maskOption === "string") {
    return masks?.[maskOption as keyof typeof masks];
  }

  return maskOption;
}

export function createFieldStateSnapshot<
  TForm extends object,
  P extends BitPath<TForm>,
>(args: {
  state: Readonly<BitState<TForm>>;
  path: P;
  value: BitPathValue<TForm, P>;
  isHidden: boolean;
  isRequired: boolean;
  isDirty: boolean;
  isValidating: boolean;
}): BitFieldState<TForm, BitPathValue<TForm, P>> {
  const { state, path, value, isHidden, isRequired, isDirty, isValidating } =
    args;
  const pathKey = path as string;

  return {
    value,
    error: state.errors[pathKey as keyof BitErrors<TForm>],
    touched: !!state.touched[pathKey as keyof typeof state.touched],
    isHidden,
    isRequired,
    isDirty,
    isValidating,
  };
}
