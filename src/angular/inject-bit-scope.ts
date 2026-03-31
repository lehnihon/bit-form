import type { Signal } from "@angular/core";
import { computed, DestroyRef, inject, signal } from "@angular/core";
import type { ScopeStatus, ValidateScopeResult } from "../core";
import { observeScopeStatusSnapshot } from "../core";
import { useBitStore } from "./provider";

export type { ScopeStatus, ValidateScopeResult };

interface InjectBitScopeResult {
  scopeName: string;
  status: Signal<ScopeStatus>;
  errors: Signal<Record<string, string>>;
  validate: () => Promise<ValidateScopeResult>;
  getErrors: () => Record<string, string>;
  isValid: Signal<boolean>;
  isDirty: Signal<boolean>;
  unsubscribe: () => void;
}

export function injectBitScope(scopeName: string): InjectBitScopeResult {
  const store = useBitStore();
  const initialStatus = store.read.getScopeStatus(scopeName);

  const status = signal<ScopeStatus>(initialStatus);

  const unsubscribe = observeScopeStatusSnapshot(
    store,
    scopeName,
    (nextStatus) => {
      status.set(nextStatus);
    },
  );

  const destroyRef = inject(DestroyRef, { optional: true });
  destroyRef?.onDestroy(() => unsubscribe());

  const validate = async (): Promise<ValidateScopeResult> => {
    const valid = await store.feature.validate({ scope: scopeName });
    const errors = store.read.getScopeErrors(scopeName);
    return { valid, errors };
  };

  const getErrors = () => store.read.getScopeErrors(scopeName);

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
