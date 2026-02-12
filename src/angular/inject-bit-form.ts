import { signal, computed, inject, DestroyRef } from '@angular/core';
import { useBitStore } from './provider';

export function injectBitForm<T extends object>() {
  const store = useBitStore<T>();
  
  const stateSignal = signal(store.getState());

  const sub = store.subscribe(() => {
    stateSignal.set({ ...store.getState() });
  });

  inject(DestroyRef).onDestroy(() => sub());

  return {
    values: computed(() => stateSignal().values),
    errors: computed(() => stateSignal().errors),
    touched: computed(() => stateSignal().touched),
    isValid: computed(() => stateSignal().isValid),
    isSubmitting: computed(() => stateSignal().isSubmitting),
    isDirty: computed(() => stateSignal().isDirty), 
    reset: () => store.reset(),
    setValues: (v: T) => store.setValues(v),
    setField: store.setField.bind(store),
    pushItem: store.pushItem.bind(store),
    removeItem: store.removeItem.bind(store),
    insertItem: store.insertItem.bind(store),
    moveItem: store.moveItem.bind(store),
    swapItems: store.swapItems.bind(store),
    submit: (onSuccess: (values: T) => void | Promise<void>) => {
      return (event?: Event) => {
        if (event) {
          event.preventDefault();
          event.stopPropagation();
        }
        return store.submit(onSuccess);
      };
    }
  };
}