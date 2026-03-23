import { computed, onUnmounted, shallowRef, ref } from "vue";
import { useBitStore } from "./context";
import { createFrameworkFormBinding } from "../core/bindings/form-binding";
import { observeFormMetaSnapshot } from "../core";
import type { UseBitFormResult } from "./types";

export function useBitForm<T extends object>(): UseBitFormResult<T> {
  const store = useBitStore<T>();
  const state = shallowRef({
    isValid: true,
    isDirty: false,
    isSubmitting: false,
  });
  const submitError = ref<Error | null>(null);
  const lastResponse = ref<unknown>(null);

  const unsubscribe = observeFormMetaSnapshot(store, (nextMeta) => {
    state.value = nextMeta;
  });

  onUnmounted(unsubscribe);

  const { controller, actions } = createFrameworkFormBinding(store, {
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
    ...actions,
  };
}
