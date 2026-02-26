import { signal, computed, DestroyRef, inject } from "@angular/core";
import { useBitStore } from "./provider";

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

export function injectBitStep(scopeName: string) {
  const store = useBitStore();
  const initialStatus = store.getStepStatus(scopeName);

  const status = signal<StepStatus>(initialStatus);

  const unsubscribe = store.subscribe(() => {
    const newStatus = store.getStepStatus(scopeName);
    const current = status();
    if (
      newStatus.hasErrors !== current.hasErrors ||
      newStatus.isDirty !== current.isDirty ||
      !errorsEqual(newStatus.errors, current.errors)
    ) {
      status.set(newStatus);
    }
  });

  try {
    const destroyRef = inject(DestroyRef);
    destroyRef.onDestroy(() => unsubscribe());
  } catch {}

  const validateStep = async (): Promise<ValidateStepResult> => {
    const valid = await store.validate({ scope: scopeName });
    const errors = store.getStepErrors(scopeName);
    return { valid, errors };
  };

  const getStepErrors = () => store.getStepErrors(scopeName);

  const isValid = computed(() => !status().hasErrors);
  const isDirty = computed(() => status().isDirty);

  return {
    status,
    validateStep,
    getStepErrors,
    isValid,
    isDirty,
    unsubscribe,
  };
}
