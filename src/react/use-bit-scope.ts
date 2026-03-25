import { useCallback, useSyncExternalStore, useRef } from "react";
import type { ScopeStatus, ValidateScopeResult } from "../core";
import { isScopeStatusEqual } from "../core";
import { useBitStore } from "./context";

export type { ScopeStatus, ValidateScopeResult };

export function useBitScope(scopeName: string) {
  const store = useBitStore();

  const lastStatus = useRef<ScopeStatus | null>(null);

  const getStatusSnapshot = useCallback(() => {
    const nextStatus = store.getScopeStatus(scopeName);

    if (
      lastStatus.current &&
      isScopeStatusEqual(lastStatus.current, nextStatus)
    ) {
      return lastStatus.current;
    }

    lastStatus.current = nextStatus;
    return nextStatus;
  }, [store, scopeName]);

  // Assina apenas os slices de estado relevantes para o escopo (errors e
  // isDirty), evitando execuções desnecessárias do getStatusSnapshot em
  // mudanças não relacionadas (isSubmitting, isValidating de outros campos…)
  const subscribe = useCallback(
    (cb: () => void) => store.subscribeScopeStatus(scopeName, () => cb()),
    [store, scopeName],
  );

  const status = useSyncExternalStore(
    subscribe,
    getStatusSnapshot,
    getStatusSnapshot,
  );

  const validate = useCallback(async (): Promise<ValidateScopeResult> => {
    const valid = await store.validate({ scope: scopeName });
    const errors = store.getScopeErrors(scopeName);
    return { valid, errors };
  }, [store, scopeName]);

  const getErrors = useCallback(() => {
    return store.getScopeErrors(scopeName);
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
