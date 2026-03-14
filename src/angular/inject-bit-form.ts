import { signal, computed, inject, DestroyRef } from "@angular/core";
import { useBitStore } from "./provider";
import { createFormController } from "../core/form-controller";
import type { InjectBitFormResult } from "./types";

export function injectBitForm<T extends object>(): InjectBitFormResult<T> {
  const store = useBitStore<T>();
  const destroyRef = inject(DestroyRef);
  const stateSignal = signal({
    isValid: store.getState().isValid,
    isSubmitting: store.getState().isSubmitting,
    isDirty: store.getState().isDirty,
  });
  const submitError = signal<Error | null>(null);
  const lastResponse = signal<unknown>(null);

  const sub = store.subscribeSelector(
    (state) => ({
      isValid: state.isValid,
      isSubmitting: state.isSubmitting,
      isDirty: state.isDirty,
    }),
    (nextState) => {
      stateSignal.set(nextState);
    },
  );

  destroyRef.onDestroy(() => sub());

  const isValid = computed(() => stateSignal().isValid);
  const isSubmitting = computed(() => stateSignal().isSubmitting);
  const isDirty = computed(() => stateSignal().isDirty);

  const controller = createFormController(
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
    replaceValues: store.replaceValues.bind(store),
    hydrate: store.hydrate.bind(store),
    rebase: store.rebase.bind(store),
    setError: store.setError.bind(store),
    setErrors: store.setErrors.bind(store),
    setServerErrors: store.setServerErrors.bind(store),
    setField: store.setField.bind(store),
    blurField: store.blurField.bind(store),
    validate: store.validate.bind(store),
  };
}
