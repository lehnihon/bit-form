import { computed, DestroyRef, inject, signal } from "@angular/core";
import type { ScopeStatus, ValidateScopeResult } from "../core";
import { isScopeStatusEqual } from "../core";
import { useBitStore } from "./provider";
import type { InjectBitStepsResult } from "./types";

export function injectBitSteps(scopeNames: string[]): InjectBitStepsResult {
  const store = useBitStore();
  const stepIndex = signal(0);

  const scope = computed(() => scopeNames[stepIndex()] ?? "");

  const getCurrentScope = () => scopeNames[stepIndex()] ?? "";
  const status = signal<ScopeStatus>(
    store.read.getScopeStatus(getCurrentScope()),
  );

  const updateStatus = (scopeName: string) => {
    const newStatus = store.read.getScopeStatus(scopeName);
    const current = status();
    if (getCurrentScope() === scopeName && !isScopeStatusEqual(current, newStatus)) {
      status.set(newStatus);
    }
  };

  let unsubscribe = store.observe.subscribeScopeStatus(
    getCurrentScope(),
    () => updateStatus(getCurrentScope()),
  );

  const rebindScopeSubscription = () => {
    unsubscribe();
    unsubscribe = store.observe.subscribeScopeStatus(
      getCurrentScope(),
      () => updateStatus(getCurrentScope()),
    );
  };

  const destroyRef = inject(DestroyRef, { optional: true });
  destroyRef?.onDestroy(() => unsubscribe());

  const validate = async (): Promise<ValidateScopeResult> => {
    const scopeName = getCurrentScope();
    const valid = await store.feature.validate({ scope: scopeName });
    const errors = store.read.getScopeErrors(scopeName);
    return { valid, errors };
  };

  const getErrors = () => store.read.getScopeErrors(getCurrentScope());

  const next = async (): Promise<boolean> => {
    const scopeName = getCurrentScope();

    const scopeFields = store.read.getScopeFields(scopeName);
    if (store.feature.hasValidationsInProgress(scopeFields)) {
      return false;
    }

    const valid = await store.feature.validate({ scope: scopeName });
    if (valid) {
      const newIndex = Math.min(stepIndex() + 1, scopeNames.length - 1);
      stepIndex.set(newIndex);
      status.set(store.read.getScopeStatus(scopeNames[newIndex] ?? ""));
      rebindScopeSubscription();
    } else {
      const errors = store.read.getScopeErrors(scopeName);
      const pathsWithErrors = Object.keys(errors);
      if (pathsWithErrors.length > 0) {
        store.write.markFieldsTouched(pathsWithErrors);
      }
    }
    return valid;
  };

  const prev = () => {
    const newIndex = Math.max(stepIndex() - 1, 0);
    stepIndex.set(newIndex);
    status.set(store.read.getScopeStatus(scopeNames[newIndex] ?? ""));
    rebindScopeSubscription();
  };

  const goTo = (targetStep: number) => {
    const newIndex = Math.max(
      0,
      Math.min(targetStep - 1, scopeNames.length - 1),
    );
    stepIndex.set(newIndex);
    status.set(store.read.getScopeStatus(scopeNames[newIndex] ?? ""));
    rebindScopeSubscription();
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
