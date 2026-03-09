import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import type { ScopeStatus, ValidateScopeResult } from "../core";
import { useBitStore } from "./context";

function errorsEqual(
  a: Record<string, string>,
  b: Record<string, string>,
): boolean {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every((k) => a[k] === b[k]);
}

export interface UseBitStepsResult {
  step: import("vue").ComputedRef<number>;
  stepIndex: import("vue").Ref<number>;
  scope: import("vue").ComputedRef<string>;
  next: () => Promise<boolean>;
  prev: () => void;
  goTo: (step: number) => void;
  isFirst: import("vue").ComputedRef<boolean>;
  isLast: import("vue").ComputedRef<boolean>;
  status: import("vue").Ref<ScopeStatus>;
  errors: import("vue").ComputedRef<Record<string, string>>;
  isValid: import("vue").ComputedRef<boolean>;
  isDirty: import("vue").ComputedRef<boolean>;
  validate: () => Promise<ValidateScopeResult>;
  getErrors: () => Record<string, string>;
}

export function useBitSteps(scopeNames: string[]): UseBitStepsResult {
  const store = useBitStore();
  const stepIndex = ref(0);

  const scope = computed(() => scopeNames[stepIndex.value] ?? "");
  const status = ref<ScopeStatus>(store.getStepStatus(scope.value));
  let unsubscribe: () => void;

  watch(scope, (newScope) => {
    status.value = store.getStepStatus(newScope);
  });

  const updateStatus = () => {
    const scopeName = scope.value;
    const newStatus = store.getStepStatus(scopeName);
    if (
      newStatus.hasErrors !== status.value.hasErrors ||
      newStatus.isDirty !== status.value.isDirty ||
      !errorsEqual(newStatus.errors, status.value.errors)
    ) {
      status.value = newStatus;
    }
  };

  onMounted(() => {
    unsubscribe = store.subscribe(updateStatus);
  });

  onUnmounted(() => {
    unsubscribe?.();
  });

  const validate = async (): Promise<ValidateScopeResult> => {
    const scopeName = scope.value;
    const valid = await store.validate({ scope: scopeName });
    const errors = store.getStepErrors(scopeName);
    return { valid, errors };
  };

  const getErrors = () => store.getStepErrors(scope.value);

  const next = async (): Promise<boolean> => {
    const scopeName = scope.value;

    const scopeFields = store.getConfig().scopes?.[scopeName];
    if (store.hasValidationsInProgress(scopeFields)) {
      return false;
    }

    const valid = await store.validate({ scope: scopeName });
    if (valid) {
      stepIndex.value = Math.min(stepIndex.value + 1, scopeNames.length - 1);
    } else {
      const errors = store.getStepErrors(scopeName);
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
