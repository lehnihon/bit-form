import type { BitErrors, BitState } from "../contracts/types";

export function buildFieldUnregisterPatch<T extends object>(args: {
  state: Readonly<BitState<T>>;
  path: string;
}): Pick<BitState<T>, "errors" | "touched"> | null {
  const { state, path } = args;

  const nextErrors = { ...state.errors };
  const nextTouched = { ...state.touched };
  let changed = false;

  if (nextErrors[path as keyof BitErrors<T>]) {
    delete nextErrors[path as keyof BitErrors<T>];
    changed = true;
  }

  if (nextTouched[path as keyof typeof nextTouched]) {
    delete nextTouched[path as keyof typeof nextTouched];
    changed = true;
  }

  if (!changed) {
    return null;
  }

  return {
    errors: nextErrors,
    touched: nextTouched,
  };
}
