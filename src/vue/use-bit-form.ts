import { computed, onUnmounted, shallowRef } from "vue";
import { useBitStore } from "./context";

export function useBitForm<T extends object>() {
  const store = useBitStore<T>();
  const state = shallowRef(store.getState());

  const unsubscribe = store.subscribe(() => {
    state.value = { ...store.getState() };
  });

  onUnmounted(unsubscribe);

  const getValues = () => state.value.values;
  const getErrors = () => state.value.errors;
  const getTouched = () => state.value.touched;

  return {
    isValid: computed(() => state.value.isValid),
    isSubmitting: computed(() => state.value.isSubmitting),
    isDirty: computed(() => state.value.isDirty),
    getValues,
    getErrors,
    getTouched,
    submit: (onSuccess: (values: T) => void | Promise<void>) => {
      return (e?: Event) => {
        e?.preventDefault?.();
        return store.submit(onSuccess);
      };
    },

    reset: store.reset.bind(store),
    validate: store.validate.bind(store),
    setValues: store.setValues.bind(store),
    setError: store.setError.bind(store),
    setErrors: store.setErrors.bind(store),
    setField: store.setField.bind(store),
    registerMask: store.registerMask.bind(store),
    pushItem: store.pushItem.bind(store),
    prependItem: store.prependItem.bind(store),
    removeItem: store.removeItem.bind(store),
    insertItem: store.insertItem.bind(store),
    moveItem: store.moveItem.bind(store),
    swapItems: store.swapItems.bind(store),
    store,
  };
}
