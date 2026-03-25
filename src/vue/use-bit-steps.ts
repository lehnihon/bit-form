import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import type { ScopeStatus, ValidateScopeResult } from "../core";
import { isScopeStatusEqual } from "../core";
import { useBitStore } from "./context";
import type { UseBitStepsResult } from "./types";

export function useBitSteps(scopeNames: string[]): UseBitStepsResult {
  const store = useBitStore();
  const stepIndex = ref(0);

  const scope = computed(() => scopeNames[stepIndex.value] ?? "");
  const status = ref<ScopeStatus>(store.getScopeStatus(scope.value));
  let unsubscribe: (() => void) | undefined;

  watch(scope, (newScope) => {
    status.value = store.getScopeStatus(newScope);
    unsubscribe?.();
    unsubscribe = store.subscribeScopeStatus(newScope, updateStatus);
  });

  const updateStatus = () => {
    const scopeName = scope.value;
    const newStatus = store.getScopeStatus(scopeName);
    if (!isScopeStatusEqual(status.value, newStatus)) {
      status.value = newStatus;
    }
  };

  onMounted(() => {
    unsubscribe = store.subscribeScopeStatus(scope.value, updateStatus);
  });

  onUnmounted(() => {
    unsubscribe?.();
  });

  const validate = async (): Promise<ValidateScopeResult> => {
    const scopeName = scope.value;
    const valid = await store.validate({ scope: scopeName });
    const errors = store.getScopeErrors(scopeName);
    return { valid, errors };
  };

  const getErrors = () => store.getScopeErrors(scope.value);

  const next = async (): Promise<boolean> => {
    const scopeName = scope.value;

    const scopeFields = store.getScopeFields(scopeName);
    if (store.hasValidationsInProgress(scopeFields)) {
      return false;
    }

    const valid = await store.validate({ scope: scopeName });
    if (valid) {
      stepIndex.value = Math.min(stepIndex.value + 1, scopeNames.length - 1);
    } else {
      const errors = store.getScopeErrors(scopeName);
      const pathsWithErrors = Object.keys(errors);
      if (pathsWithErrors.length > 0) {
        store.markFieldsTouched(pathsWithErrors);
      }
    }
    return valid;
  };

  const prev = () => {
    stepIndex.value = Math.max(stepIndex.value - 1, 0);
  };

  const goTo = (targetStep: number) => {
    stepIndex.value = Math.max(
      0,
      Math.min(targetStep - 1, scopeNames.length - 1),
    );
  };

  const step = computed(() => stepIndex.value + 1);
  const isFirst = computed(() => stepIndex.value === 0);
  const isLast = computed(() => stepIndex.value >= scopeNames.length - 1);
  const isValid = computed(() => !status.value.hasErrors);
  const isDirty = computed(() => status.value.isDirty);
  const errors = computed(() => status.value.errors);

  return {
    step,
    stepIndex,
    scope,
    next,
    prev,
    goTo,
    isFirst,
    isLast,
    status,
    errors,
    isValid,
    isDirty,
    validate,
    getErrors,
  };
}
