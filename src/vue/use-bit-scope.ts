import { ref, computed, onMounted, onUnmounted } from "vue";
import type { ScopeStatus, ValidateScopeResult } from "../core";
import { useBitStore } from "./context";

export type { ScopeStatus, ValidateScopeResult };

function errorsEqual(
  a: Record<string, string>,
  b: Record<string, string>,
): boolean {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every((k) => a[k] === b[k]);
}

export function useBitScope(scopeName: string) {
  const store = useBitStore();
  const status = ref<ScopeStatus>(store.getStepStatus(scopeName));
  let unsubscribe: () => void;

  onMounted(() => {
    unsubscribe = store.subscribeSelector(
      (state) => ({ errors: state.errors, isDirty: state.isDirty }),
      () => {
        const newStatus = store.getStepStatus(scopeName);
        if (
          newStatus.hasErrors !== status.value.hasErrors ||
          newStatus.isDirty !== status.value.isDirty ||
          !errorsEqual(newStatus.errors, status.value.errors)
        ) {
          status.value = newStatus;
        }
      },
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
