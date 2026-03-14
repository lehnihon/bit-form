import { computed, onUnmounted, shallowRef, ref } from "vue";
import { useBitStore } from "./context";
import { createFormController } from "../core/form-controller";
import type { UseBitFormResult } from "./types";

export function useBitForm<T extends object>(): UseBitFormResult<T> {
  const store = useBitStore<T>();
  const state = shallowRef({
    isValid: store.getState().isValid,
    isSubmitting: store.getState().isSubmitting,
    isDirty: store.getState().isDirty,
  });
  const submitError = ref<Error | null>(null);
  const lastResponse = ref<unknown>(null);

  const unsubscribe = store.subscribeSelector(
    (snapshot) => ({
      isValid: snapshot.isValid,
      isSubmitting: snapshot.isSubmitting,
      isDirty: snapshot.isDirty,
    }),
    (nextState) => {
      state.value = nextState;
    },
  );

  onUnmounted(unsubscribe);

  const controller = createFormController(store, {
    clearSubmissionState: () => {
      submitError.value = null;
      lastResponse.value = null;
    },
    setSubmissionResult: (result) => {
      lastResponse.value = result;
    },
    setSubmissionError: (error) => {
      submitError.value = error;
    },
  });

  const isValid = computed(() => state.value.isValid);
  const isSubmitting = computed(() => state.value.isSubmitting);
  const isDirty = computed(() => state.value.isDirty);

  const onSubmit = controller.onSubmit;
  const reset = controller.reset;

  const meta = {
    isValid,
    isDirty,
    isSubmitting,
    submitError,
    lastResponse,
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
    onSubmit,
    reset,
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
