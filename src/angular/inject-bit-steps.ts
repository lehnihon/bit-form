import { signal, computed, DestroyRef, inject } from "@angular/core";
import type { ScopeStatus, ValidateScopeResult } from "../core";
import { useBitStore } from "./provider";

function errorsEqual(
  a: Record<string, string>,
  b: Record<string, string>,
): boolean {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every((k) => a[k] === b[k]);
}

export interface InjectBitStepsResult {
  step: ReturnType<typeof computed<number>>;
  stepIndex: ReturnType<typeof signal<number>>;
  scope: ReturnType<typeof computed<string>>;
  next: () => Promise<boolean>;
  prev: () => void;
  goTo: (step: number) => void;
  isFirst: ReturnType<typeof computed<boolean>>;
  isLast: ReturnType<typeof computed<boolean>>;
  status: ReturnType<typeof signal<ScopeStatus>>;
  errors: ReturnType<typeof computed<Record<string, string>>>;
  isValid: ReturnType<typeof computed<boolean>>;
  isDirty: ReturnType<typeof computed<boolean>>;
  validate: () => Promise<ValidateScopeResult>;
  getErrors: () => Record<string, string>;
}

export function injectBitSteps(scopeNames: string[]): InjectBitStepsResult {
  const store = useBitStore();
  const stepIndex = signal(0);

  const scope = computed(() => scopeNames[stepIndex()] ?? "");

  const getCurrentScope = () => scopeNames[stepIndex()] ?? "";
  const status = signal<ScopeStatus>(store.getStepStatus(getCurrentScope()));

  const updateStatus = () => {
    const scopeName = getCurrentScope();
    const newStatus = store.getStepStatus(scopeName);
    const current = status();
    if (
      newStatus.hasErrors !== current.hasErrors ||
      newStatus.isDirty !== current.isDirty ||
      !errorsEqual(newStatus.errors, current.errors)
    ) {
      status.set(newStatus);
    }
  };

  const unsubscribe = store.subscribe(updateStatus);

  try {
    const destroyRef = inject(DestroyRef);
    destroyRef.onDestroy(() => unsubscribe());
  } catch {}

  const validate = async (): Promise<ValidateScopeResult> => {
    const scopeName = getCurrentScope();
    const valid = await store.validate({ scope: scopeName });
    const errors = store.getStepErrors(scopeName);
    return { valid, errors };
  };

  const getErrors = () => store.getStepErrors(getCurrentScope());

  const next = async (): Promise<boolean> => {
    const scopeName = getCurrentScope();

    const scopeFields = store.getConfig().scopes?.[scopeName];
    if (store.hasValidationsInProgress(scopeFields)) {
      return false;
    }

    const valid = await store.validate({ scope: scopeName });
    if (valid) {
      const newIndex = Math.min(stepIndex() + 1, scopeNames.length - 1);
      stepIndex.set(newIndex);
      status.set(store.getStepStatus(scopeNames[newIndex] ?? ""));
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
    const newIndex = Math.max(stepIndex() - 1, 0);
    stepIndex.set(newIndex);
    status.set(store.getStepStatus(scopeNames[newIndex] ?? ""));
  };

  const goTo = (targetStep: number) => {
    const newIndex = Math.max(
      0,
      Math.min(targetStep - 1, scopeNames.length - 1),
    );
    stepIndex.set(newIndex);
    status.set(store.getStepStatus(scopeNames[newIndex] ?? ""));
  };

  const step = computed(() => stepIndex() + 1);
  const isFirst = computed(() => stepIndex() === 0);
  const isLast = computed(() => stepIndex() >= scopeNames.length - 1);
  const isValid = computed(() => !status().hasErrors);
  const isDirty = computed(() => status().isDirty);
  const errors = computed(() => status().errors);

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
