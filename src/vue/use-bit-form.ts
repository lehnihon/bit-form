import { computed, onUnmounted, shallowRef, ref } from "vue";
import { useBitStore } from "./context";
import { isValidationErrorShape, extractServerErrors } from "../core/utils";

export function useBitForm<T extends object>() {
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

  const getValues = () => store.getState().values;
  const getErrors = () => store.getState().errors;
  const getTouched = () => store.getState().touched;
  const getDirtyValues = () => store.getDirtyValues();

  const isValid = computed(() => state.value.isValid);
  const isSubmitting = computed(() => state.value.isSubmitting);
  const isDirty = computed(() => state.value.isDirty);

  const onSubmit = (
    handler: (values: T, dirtyValues?: Partial<T>) => Promise<unknown>,
  ) => {
    return (e?: Event) => {
      e?.preventDefault?.();
      submitError.value = null;
      return store.submit(async (values, dirtyValues) => {
        try {
          const result = await handler(values, dirtyValues);
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
    getDirtyValues,
    // Main actions (frequent use - flat)
    submit: (
      onSuccess: (values: T, dirtyValues?: Partial<T>) => void | Promise<void>,
    ) => {
      return (e?: Event) => {
        e?.preventDefault?.();
        return store.submit(onSuccess);
      };
    },
    onSubmit,
    reset,
    replaceValues: store.replaceValues.bind(store),
    hydrate: store.hydrate.bind(store),
    rebase: store.rebase.bind(store),
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
  };
}
