import { ref, computed, onMounted, onUnmounted } from "vue";
import type { ScopeStatus, ValidateScopeResult } from "../core";
import {
  getScopeSubscriptionPaths,
  isScopeStatusEqual,
} from "../core/scope-status";
import { useBitStore } from "./context";

export type { ScopeStatus, ValidateScopeResult };

export function useBitScope(scopeName: string) {
  const store = useBitStore();
  const scopeFields = store.getScopeFields(scopeName);
  const status = ref<ScopeStatus>(store.getStepStatus(scopeName));
  let unsubscribe: () => void;

  onMounted(() => {
    unsubscribe = store.subscribeSelector(
      (state) => ({ errors: state.errors, isDirty: state.isDirty }),
      () => {
        const newStatus = store.getStepStatus(scopeName);
        if (!isScopeStatusEqual(status.value, newStatus)) {
          status.value = newStatus;
        }
      },
      { paths: getScopeSubscriptionPaths(scopeFields) },
    );
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
