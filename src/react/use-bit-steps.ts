import {
  useCallback,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { ScopeStatus, ValidateScopeResult } from "../core";
import { isScopeStatusEqual } from "../core";
import { useBitStore } from "./context";
import type { UseBitStepsResult } from "./types";

export function useBitSteps(scopeNames: string[]): UseBitStepsResult {
  const store = useBitStore();
  const [stepIndex, setStepIndex] = useState(0);

  const scope = scopeNames[stepIndex] ?? "";
  const lastStatus = useRef<ScopeStatus | null>(null);

  const getStatusSnapshot = useCallback(() => {
    const nextStatus = store.read.getScopeStatus(scope);

    if (
      lastStatus.current &&
      isScopeStatusEqual(lastStatus.current, nextStatus)
    ) {
      return lastStatus.current;
    }

    lastStatus.current = nextStatus;
    return nextStatus;
  }, [store, scope]);

  const status = useSyncExternalStore(
    useCallback(
      (cb: () => void) => store.observe.subscribeScopeStatus(scope, () => cb()),
      [store, scope],
    ),
    getStatusSnapshot,
    getStatusSnapshot,
  );

  const validate = useCallback(async (): Promise<ValidateScopeResult> => {
    const valid = await store.feature.validate({ scope });
    const errors = store.read.getScopeErrors(scope);
    return { valid, errors };
  }, [store, scope]);

  const getErrors = useCallback(() => {
    return store.read.getScopeErrors(scope);
  }, [store, scope]);

  const next = useCallback(async (): Promise<boolean> => {
    const scopeFields = store.read.getScopeFields(scope);

    if (store.feature.hasValidationsInProgress(scopeFields)) {
      return false;
    }

    const valid = await store.feature.validate({ scope });
    if (valid) {
      setStepIndex((s) => Math.min(s + 1, scopeNames.length - 1));
    } else {
      const errors = store.read.getScopeErrors(scope);
      const pathsWithErrors = Object.keys(errors);
      if (pathsWithErrors.length > 0) {
        store.write.markFieldsTouched(pathsWithErrors);
      }
    }
    return valid;
  }, [store, scope, scopeNames.length]);

  const prev = useCallback(() => {
    setStepIndex((s) => Math.max(s - 1, 0));
  }, []);

  const goTo = useCallback(
    (targetStep: number) => {
      setStepIndex(
        Math.max(0, Math.min(targetStep - 1, scopeNames.length - 1)),
      );
    },
    [scopeNames.length],
  );

  const isFirst = stepIndex === 0;
  const isLast = stepIndex >= scopeNames.length - 1;

  return useMemo(
    () => ({
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
    }),
    [
      stepIndex,
      scope,
      next,
      prev,
      goTo,
      isFirst,
      isLast,
      status,
      validate,
      getErrors,
    ],
  );
}
