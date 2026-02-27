import { useCallback, useSyncExternalStore, useRef, useState } from "react";
import type { ScopeStatus, ValidateScopeResult } from "../core";
import { useBitStore } from "./context";

export interface UseBitStepsResult {
  step: number;
  stepIndex: number;
  scope: string;
  next: () => Promise<boolean>;
  prev: () => void;
  goTo: (step: number) => void;
  isFirst: boolean;
  isLast: boolean;
  status: ScopeStatus;
  errors: Record<string, string>;
  isValid: boolean;
  isDirty: boolean;
  validate: () => Promise<ValidateScopeResult>;
  getErrors: () => Record<string, string>;
}

export function useBitSteps(scopeNames: string[]): UseBitStepsResult {
  const store = useBitStore();
  const [stepIndex, setStepIndex] = useState(0);

  const scope = scopeNames[stepIndex] ?? "";
  const lastStatus = useRef<ScopeStatus | null>(null);

  const getStatusSnapshot = useCallback(() => {
    const nextStatus = store.getStepStatus(scope);

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
  }, [store, scope]);

  const status = useSyncExternalStore(
    store.subscribe.bind(store),
    getStatusSnapshot,
    getStatusSnapshot,
  );

  const validate = useCallback(async (): Promise<ValidateScopeResult> => {
    const valid = await store.validate({ scope });
    const errors = store.getStepErrors(scope);
    return { valid, errors };
  }, [store, scope]);

  const getErrors = useCallback(() => {
    return store.getStepErrors(scope);
  }, [store, scope]);

  const next = useCallback(async (): Promise<boolean> => {
    const valid = await store.validate({ scope });
    if (valid) {
      setStepIndex((s) => Math.min(s + 1, scopeNames.length - 1));
    }
    return valid;
  }, [store, scope, scopeNames.length]);

  const prev = useCallback(() => {
    setStepIndex((s) => Math.max(s - 1, 0));
  }, []);

  const goTo = useCallback((targetStep: number) => {
    setStepIndex(
      Math.max(0, Math.min(targetStep - 1, scopeNames.length - 1)),
    );
  }, [scopeNames.length]);

  const isFirst = stepIndex === 0;
  const isLast = stepIndex >= scopeNames.length - 1;

  return {
    step: stepIndex + 1,
    stepIndex,
    scope,
    next,
    prev,
    goTo,
    isFirst,
    isLast,
    status,
    errors: status.errors,
    isValid: !status.hasErrors,
    isDirty: status.isDirty,
    validate,
    getErrors,
  };
}
