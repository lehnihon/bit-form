import { signal, computed, inject, DestroyRef } from "@angular/core";
import { useBitStore } from "./provider";
import { createFrameworkFormBinding } from "../core/bindings/form-binding";
import { observeFormMetaSnapshot } from "../core";
import type { InjectBitFormResult } from "./types";

export function injectBitForm<T extends object>(): InjectBitFormResult<T> {
  const store = useBitStore<T>();
  const destroyRef = inject(DestroyRef);
  const stateSignal = signal({
    isValid: true,
    isDirty: false,
    isSubmitting: false,
  });
  const submitError = signal<Error | null>(null);
  const lastResponse = signal<unknown>(null);

  const sub = observeFormMetaSnapshot(store, (nextMeta) => {
    stateSignal.set(nextMeta);
  });

  destroyRef.onDestroy(() => sub());

  const isValid = computed(() => stateSignal().isValid);
  const isSubmitting = computed(() => stateSignal().isSubmitting);
  const isDirty = computed(() => stateSignal().isDirty);

  const { controller, actions } = createFrameworkFormBinding(
    store,
    {
      clearSubmissionState: () => {
        submitError.set(null);
        lastResponse.set(null);
      },
      setSubmissionResult: (result) => {
        lastResponse.set(result);
      },
      setSubmissionError: (error) => {
        submitError.set(error);
      },
    },
    { stopPropagation: true },
  );

  const meta = {
    isValid,
    isDirty,
    isSubmitting,
    submitError: submitError.asReadonly(),
    lastResponse: lastResponse.asReadonly(),
  };

  return {
    // Metadata (grouped)
    meta,
    // Getters
    getValues: controller.getValues,
    getErrors: controller.getErrors,
    getTouched: controller.getTouched,
    getDirtyValues: controller.getDirtyValues,
    // Main actions (frequent use - flat)
    submit: controller.submit,
    onSubmit: controller.onSubmit,
    reset: controller.reset,
    ...actions,
  };
}
