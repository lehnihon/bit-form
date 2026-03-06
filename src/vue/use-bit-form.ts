import { computed, onUnmounted, shallowRef, ref } from "vue";
import { useBitStore } from "./context";
import { isValidationErrorShape, extractServerErrors } from "../core/utils";

export function useBitForm<T extends object>() {
  const store = useBitStore<T>();
  const state = shallowRef(store.getState());
  const submitError = ref<Error | null>(null);
  const lastResponse = ref<unknown>(null);

  const unsubscribe = store.subscribe(() => {
    state.value = { ...store.getState() };
  });

  onUnmounted(unsubscribe);

  const getValues = () => state.value.values;
  const getErrors = () => state.value.errors;
  const getTouched = () => state.value.touched;

  const isValid = computed(() => state.value.isValid);
  const isSubmitting = computed(() => state.value.isSubmitting);
  const isDirty = computed(() => state.value.isDirty);

  const canUndo = computed(() => {
    state.value;
    return store.canUndo;
  });

  const canRedo = computed(() => {
    state.value;
    return store.canRedo;
  });

  const onSubmit = (handler: (values: T) => Promise<unknown>) => {
    return (e?: Event) => {
      e?.preventDefault?.();
      submitError.value = null;
      return store.submit(async (values) => {
        try {
          const result = await handler(values);
          lastResponse.value = result;
          submitError.value = null;
        } catch (err) {
          if (isValidationErrorShape(err)) {
            store.setServerErrors(extractServerErrors(err));
          } else {
            submitError.value =
              err instanceof Error ? err : new Error(String(err));
          }
        }
      });
    };
  };

  const reset = () => {
    store.reset();
    submitError.value = null;
    lastResponse.value = null;
  };

  const meta = {
    isValid,
    isDirty,
    isSubmitting,
    canUndo,
    canRedo,
    submitError,
    lastResponse,
  };

  return {
    // Metadata (grouped)
    meta,
    // Getters
    getValues,
    getErrors,
    getTouched,
    // Main actions (frequent use - flat)
    submit: (onSuccess: (values: T) => void | Promise<void>) => {
      return (e?: Event) => {
        e?.preventDefault?.();
        return store.submit(onSuccess);
      };
    },
    onSubmit,
    reset,
    setValues: store.setValues.bind(store),
    setError: store.setError.bind(store),
    setErrors: store.setErrors.bind(store),
    setServerErrors: store.setServerErrors.bind(store),
    setField: store.setField.bind(store),
    blurField: store.blurField.bind(store),
    validate: store.validate.bind(store),
    // Array mutations (grouped)
    mutations: {
      pushItem: store.pushItem.bind(store),
      prependItem: store.prependItem.bind(store),
      removeItem: store.removeItem.bind(store),
      insertItem: store.insertItem.bind(store),
      moveItem: store.moveItem.bind(store),
      swapItems: store.swapItems.bind(store),
    },
    // History (grouped)
    history: {
      undo: store.undo.bind(store),
      redo: store.redo.bind(store),
    },
  };
}
