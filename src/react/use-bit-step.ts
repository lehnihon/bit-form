import { useCallback } from "react";
import { useBitStore } from "./context";

export function useBitStep(scopeName: string) {
  const store = useBitStore();

  const validateStep = useCallback(async () => {
    return await store.validate({ scope: scopeName });
  }, [store, scopeName]);

  const getStatus = useCallback(() => {
    return store.getStepStatus(scopeName);
  }, [store, scopeName]);

  return {
    validateStep,
    getStatus,
    get isValid() {
      return !store.getStepStatus(scopeName).hasErrors;
    },
    get isDirty() {
      return store.getStepStatus(scopeName).isDirty;
    },
  };
}
