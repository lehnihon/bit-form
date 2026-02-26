import { ref, computed, onMounted, onUnmounted } from "vue";
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

function errorsEqual(
  a: Record<string, string>,
  b: Record<string, string>,
): boolean {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every((k) => a[k] === b[k]);
}

export function useBitStep(scopeName: string) {
  const store = useBitStore();
  const status = ref<StepStatus>(store.getStepStatus(scopeName));
  let unsubscribe: () => void;

  onMounted(() => {
    unsubscribe = store.subscribe(() => {
      const newStatus = store.getStepStatus(scopeName);
      if (
        newStatus.hasErrors !== status.value.hasErrors ||
        newStatus.isDirty !== status.value.isDirty ||
        !errorsEqual(newStatus.errors, status.value.errors)
      ) {
        status.value = newStatus;
      }
    });
  });

  onUnmounted(() => {
    unsubscribe?.();
  });

  const validateStep = async (): Promise<ValidateStepResult> => {
    const valid = await store.validate({ scope: scopeName });
    const errors = store.getStepErrors(scopeName);
    return { valid, errors };
  };

  const getStepErrors = () => store.getStepErrors(scopeName);

  const isValid = computed(() => !status.value.hasErrors);
  const isDirty = computed(() => status.value.isDirty);

  return {
    status,
    validateStep,
    getStepErrors,
    isValid,
    isDirty,
  };
}
