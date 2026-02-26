import { useCallback, useSyncExternalStore, useRef } from "react";
import { useBitStore } from "./context";

export type StepStatus = {
  hasErrors: boolean;
  isDirty: boolean;
  errors: Record<string, string>;
};

export type ValidateStepResult = {
  valid: boolean;
  errors: Record<string, string>;
};

export function useBitStep(scopeName: string) {
  const store = useBitStore();

  const lastStatus = useRef<StepStatus | null>(null);

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

  const validateStep = useCallback(async (): Promise<ValidateStepResult> => {
    const valid = await store.validate({ scope: scopeName });
    const errors = store.getStepErrors(scopeName);
    return { valid, errors };
  }, [store, scopeName]);

  const getStepErrors = useCallback(() => {
    return store.getStepErrors(scopeName);
  }, [store, scopeName]);

  return {
    status,
    validateStep,
    getStepErrors,
    isValid: !status.hasErrors,
    isDirty: status.isDirty,
  };
}
