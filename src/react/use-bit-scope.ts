import { useCallback, useSyncExternalStore, useRef } from "react";
import type { ScopeStatus, ValidateScopeResult } from "../core";
import { useBitStore } from "./context";

export type { ScopeStatus, ValidateScopeResult };

export function useBitScope(scopeName: string) {
  const store = useBitStore();

  const lastStatus = useRef<ScopeStatus | null>(null);

  const getStatusSnapshot = useCallback(() => {
    const nextStatus = store.getStepStatus(scopeName);

    if (
      lastStatus.current &&
      lastStatus.current.hasErrors === nextStatus.hasErrors &&
      lastStatus.current.isDirty === nextStatus.isDirty &&
      Object.keys(lastStatus.current.errors).length ===
        Object.keys(nextStatus.errors).length &&
      Object.entries(nextStatus.errors).every(
        ([k, v]) => lastStatus.current!.errors[k] === v,
      )
    ) {
      return lastStatus.current;
    }

    lastStatus.current = nextStatus;
    return nextStatus;
  }, [store, scopeName]);

  const status = useSyncExternalStore(
    store.subscribe.bind(store),
    getStatusSnapshot,
    getStatusSnapshot,
  );

  const validate = useCallback(async (): Promise<ValidateScopeResult> => {
    const valid = await store.validate({ scope: scopeName });
    const errors = store.getStepErrors(scopeName);
    return { valid, errors };
  }, [store, scopeName]);

  const getErrors = useCallback(() => {
    return store.getStepErrors(scopeName);
  }, [store, scopeName]);

  return {
    scopeName,
    status,
    errors: status.errors,
    validate,
    getErrors,
    isValid: !status.hasErrors,
    isDirty: status.isDirty,
  };
}
