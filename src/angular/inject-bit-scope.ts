import { signal, computed, DestroyRef, inject } from "@angular/core";
import type { ScopeStatus, ValidateScopeResult } from "../core";
import {
  getScopeSubscriptionPaths,
  isScopeStatusEqual,
} from "../core/scope-status";
import { useBitStore } from "./provider";

export type { ScopeStatus, ValidateScopeResult };

export function injectBitScope(scopeName: string) {
  const store = useBitStore();
  const scopeFields = store.getScopeFields(scopeName);
  const initialStatus = store.getStepStatus(scopeName);

  const status = signal<ScopeStatus>(initialStatus);

  const unsubscribe = store.subscribeSelector(
    (state) => ({ errors: state.errors, isDirty: state.isDirty }),
    () => {
      const newStatus = store.getStepStatus(scopeName);
      const current = status();
      if (!isScopeStatusEqual(current, newStatus)) {
        status.set(newStatus);
      }
    },
    { paths: getScopeSubscriptionPaths(scopeFields) },
  );

  try {
    const destroyRef = inject(DestroyRef);
    destroyRef.onDestroy(() => unsubscribe());
  } catch {}

  const validate = async (): Promise<ValidateScopeResult> => {
    const valid = await store.validate({ scope: scopeName });
    const errors = store.getStepErrors(scopeName);
    return { valid, errors };
  };

  const getErrors = () => store.getStepErrors(scopeName);

  const isValid = computed(() => !status().hasErrors);
  const isDirty = computed(() => status().isDirty);
  const errors = computed(() => status().errors);

  return {
    scopeName,
    status,
    errors,
    validate,
    getErrors,
    isValid,
    isDirty,
    unsubscribe,
  };
}
