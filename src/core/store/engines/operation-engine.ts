import type { BitErrors, BitState } from "../contracts/types";

export interface BitStatePatchOperation<T extends object> {
  kind: "state.patch";
  partialState: Partial<BitState<T>>;
  changedPaths?: string[];
  skipComputed?: boolean;
}

export interface BitTouchFieldsOperation<_T extends object> {
  kind: "field.touchMany";
  paths: string[];
}

export interface BitPersistMetaOperation<T extends object> {
  kind: "form.persistMeta";
  patch: Partial<BitState<T>["persist"]>;
}

export interface BitHistoryApplyOperation<T extends object> {
  kind: "history.apply";
  values: T;
  isDirty: boolean;
}

export interface BitValidationCommitOperation<T extends object> {
  kind: "validation.commit";
  errors: BitErrors<T>;
  isValid: boolean;
}

export type BitStoreOperation<T extends object> =
  | BitStatePatchOperation<T>
  | BitTouchFieldsOperation<T>
  | BitPersistMetaOperation<T>
  | BitHistoryApplyOperation<T>
  | BitValidationCommitOperation<T>;

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

export function touchFieldsOperation<T extends object>(
  paths: string[],
): BitTouchFieldsOperation<T> {
  return {
    kind: "field.touchMany",
    paths,
  };
}

export function persistMetaOperation<T extends object>(
  patch: Partial<BitState<T>["persist"]>,
): BitPersistMetaOperation<T> {
  return {
    kind: "form.persistMeta",
    patch,
  };
}

export function historyApplyOperation<T extends object>(
  values: T,
  isDirty: boolean,
): BitHistoryApplyOperation<T> {
  return {
    kind: "history.apply",
    values,
    isDirty,
  };
}

export function validationCommitOperation<T extends object>(
  errors: BitErrors<T>,
  isValid: boolean,
): BitValidationCommitOperation<T> {
  return {
    kind: "validation.commit",
    errors,
    isValid,
  };
}
