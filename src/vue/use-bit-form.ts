import { computed, onUnmounted, ref, shallowRef } from "vue";
import {
  BitFrameworkStoreApi,
  BitStoreApi,
  createFrameworkFormBinding,
  observeFormMetaSnapshot,
} from "../core";
import { resolveVueStore } from "./store";
import type { UseBitFormResult } from "./types";

export function useBitForm<T extends object>(
  storeInput: BitFrameworkStoreApi<T> | BitStoreApi<T>,
): UseBitFormResult<T> {
  const store = resolveVueStore(storeInput);
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
