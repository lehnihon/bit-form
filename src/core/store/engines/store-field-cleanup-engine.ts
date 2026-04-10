import type { BitErrors, BitState } from "../contracts/types";

export function buildFieldUnregisterPatch<T extends object>(args: {
  state: Readonly<BitState<T>>;
  path: string;
}): Pick<BitState<T>, "errors" | "touched"> | null {
  const { state, path } = args;
  const prefix = `${path}.`;

  const nextErrors = { ...state.errors };
  const nextTouched = { ...state.touched };
  let changed = false;

  for (const key of Object.keys(nextErrors)) {
    if (key === path || key.startsWith(prefix)) {
      delete nextErrors[key as keyof BitErrors<T>];
      changed = true;
    }
  }

  for (const key of Object.keys(nextTouched)) {
    if (key === path || key.startsWith(prefix)) {
      delete nextTouched[key as keyof typeof nextTouched];
      changed = true;
    }
  }

  if (!changed) {
    return null;
  }

  return {
    errors: nextErrors,
    touched: nextTouched,
  };
}
