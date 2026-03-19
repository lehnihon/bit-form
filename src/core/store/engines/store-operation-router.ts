import type { BitState } from "../contracts/types";
import {
  BitStatePatchOperation,
  BitStoreOperation,
  patchStateOperation,
} from "./operation-engine";

export function routeStoreOperation<T extends object>(
  currentState: Readonly<BitState<T>>,
  operation: BitStoreOperation<T>,
): BitStatePatchOperation<T> | null {
  if (operation.kind === "state.patch") {
    return operation;
  }

  if (operation.kind === "field.touchMany") {
    if (operation.paths.length === 0) {
      return null;
    }

    const touched = { ...currentState.touched };
    for (const path of operation.paths) {
      touched[path as keyof typeof touched] = true;
    }

    return patchStateOperation({ touched }, operation.paths);
  }

  if (operation.kind === "form.persistMeta") {
    return patchStateOperation({
      persist: {
        ...currentState.persist,
        ...operation.patch,
      },
    });
  }

  if (operation.kind === "history.apply") {
    return patchStateOperation(
      {
        values: operation.values,
        isDirty: operation.isDirty,
      },
      ["*"],
      { requireExplicitChangedPaths: true },
    );
  }

  return patchStateOperation({
    errors: operation.errors,
    isValid: operation.isValid,
  });
}
