import { computed, onUnmounted, shallowRef, ref } from "vue";
import { useBitStore } from "./context";
import {
  createFormController,
  createStoreFormActions,
} from "../core/form-controller";
import { readFormMetaSnapshot, subscribeFormMetaSnapshot } from "../core";
import type { UseBitFormResult } from "./types";

export function useBitForm<T extends object>(): UseBitFormResult<T> {
  const store = useBitStore<T>();
  const state = shallowRef(readFormMetaSnapshot(store));
  const submitError = ref<Error | null>(null);
  const lastResponse = ref<unknown>(null);

  const unsubscribe = subscribeFormMetaSnapshot(store, () => {
    state.value = readFormMetaSnapshot(store);
  });

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
  const actions = createStoreFormActions(store);

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
