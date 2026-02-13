import { ref, computed, onUnmounted, shallowRef } from "vue";
import { useBitStore } from "./context";

export function useBitForm<T extends object>() {
  const store = useBitStore<T>();
  const state = shallowRef(store.getState());

  const unsubscribe = store.subscribe(() => {
    state.value = { ...store.getState() };
  });

  onUnmounted(unsubscribe);

  return {
    values: computed(() => state.value.values),
    errors: computed(() => state.value.errors),
    touched: computed(() => state.value.touched),
    isValid: computed(() => state.value.isValid),
    isSubmitting: computed(() => state.value.isSubmitting),
    isDirty: computed(() => state.value.isDirty),
    submit: (onSuccess: (values: T) => void | Promise<void>) => {
      return (e?: Event) => {
        e?.preventDefault?.();
        return store.submit(onSuccess);
      };
    },
    reset: () => store.reset(),
    validate: () => store.validate(),
    setValues: (v: T) => store.setValues(v),
    setError: (path: string, msg?: string) => store.setError(path, msg),
    setErrors: (errs: any) => store.setErrors(errs),
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
