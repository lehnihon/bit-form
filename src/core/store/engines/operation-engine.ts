import type { BitState } from "../contracts/types";

export interface BitStatePatchOperation<T extends object> {
  kind: "state.patch";
  partialState: Partial<BitState<T>>;
  changedPaths?: string[];
  skipComputed?: boolean;
}

export type BitStoreOperation<T extends object> = BitStatePatchOperation<T>;

export function patchStateOperation<T extends object>(
  partialState: Partial<BitState<T>>,
  changedPaths?: string[],
  options?: { skipComputed?: boolean },
): BitStatePatchOperation<T> {
  return {
    kind: "state.patch",
    partialState,
    changedPaths,
    skipComputed: options?.skipComputed,
  };
}
