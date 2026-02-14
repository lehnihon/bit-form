import { signal, DestroyRef, inject } from "@angular/core";
import { BitStore } from "../core/store";

export function injectBitStep<T extends object>(
  store: BitStore<T>,
  scopeName: string,
) {
  const initialStatus = store.getStepStatus(scopeName);
  const hasErrors = signal(initialStatus.hasErrors);
  const isDirty = signal(initialStatus.isDirty);

  const unsubscribe = store.subscribe(() => {
    const newStatus = store.getStepStatus(scopeName);
    if (newStatus.hasErrors !== hasErrors()) {
      hasErrors.set(newStatus.hasErrors);
    }
    if (newStatus.isDirty !== isDirty()) {
      isDirty.set(newStatus.isDirty);
    }
  });

  try {
    const destroyRef = inject(DestroyRef);
    destroyRef.onDestroy(() => {
      unsubscribe();
    });
  } catch {}

  const validate = async () => {
    return await store.validate({ scope: scopeName });
  };

  return {
    hasErrors,
    isDirty,
    validate,
    unsubscribe,
  };
}
