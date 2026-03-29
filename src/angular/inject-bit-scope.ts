import { signal, computed, DestroyRef, inject } from "@angular/core";
import type { ScopeStatus, ValidateScopeResult } from "../core";
import { observeScopeStatusSnapshot } from "../core";
import { useBitStore } from "./provider";

export type { ScopeStatus, ValidateScopeResult };

export function injectBitScope(scopeName: string) {
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

  try {
    const destroyRef = inject(DestroyRef);
    destroyRef.onDestroy(() => unsubscribe());
  } catch {}

  const validate = async (): Promise<ValidateScopeResult> => {
    const valid = await store.write.validate({ scope: scopeName });
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
