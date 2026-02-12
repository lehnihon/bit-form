import { ref, computed, onUnmounted } from 'vue';
import { useBitStore } from './context';

export function useBitForm<T extends object>() {
  const store = useBitStore<T>();
  const _trigger = ref(0);
  
  const unsubscribe = store.subscribe(() => {
    _trigger.value++;
  });

  onUnmounted(unsubscribe);

  const state = computed(() => {
    _trigger.value;
    return store.getState();
  });

  return {
    values: computed(() => state.value.values),
    errors: computed(() => state.value.errors),
    touched: computed(() => state.value.touched),
    isValid: computed(() => state.value.isValid),
    isSubmitting: computed(() => state.value.isSubmitting),
    isDirty: computed(() => state.value.isDirty),
    setField: store.setField.bind(store),
    setValues: store.setValues.bind(store),
    reset: store.reset.bind(store),
    pushItem: store.pushItem.bind(store),
    removeItem: store.removeItem.bind(store),
    insertItem: store.insertItem.bind(store),
    moveItem: store.moveItem.bind(store),
    swapItems: store.swapItems.bind(store),
    submit: (onSuccess: (values: T) => void | Promise<void>) => {
      return (e?: Event) => {
        e?.preventDefault?.();
        return store.submit(onSuccess);
      };
    }
  };
}