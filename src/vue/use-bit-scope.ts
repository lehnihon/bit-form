import { ref, computed, onMounted, onUnmounted } from "vue";
import type { ScopeStatus, ValidateScopeResult } from "../core";
import { observeScopeStatusSnapshot } from "../core";
import { useBitStore } from "./context";

export type { ScopeStatus, ValidateScopeResult };

export function useBitScope(scopeName: string) {
  const store = useBitStore();
  const status = ref<ScopeStatus>(store.getScopeStatus(scopeName));
  let unsubscribe: () => void;

  onMounted(() => {
    unsubscribe = observeScopeStatusSnapshot(store, scopeName, (nextStatus) => {
      status.value = nextStatus;
    });
  });

  onUnmounted(() => {
    unsubscribe?.();
  });

  const validate = async (): Promise<ValidateScopeResult> => {
    const valid = await store.validate({ scope: scopeName });
    const errors = store.getStepErrors(scopeName);
    return { valid, errors };
  };

  const getErrors = () => store.getStepErrors(scopeName);

  const isValid = computed(() => !status.value.hasErrors);
  const isDirty = computed(() => status.value.isDirty);
  const errors = computed(() => status.value.errors);

  return {
    scopeName,
    status,
    errors,
    validate,
    getErrors,
    isValid,
    isDirty,
  };
}
