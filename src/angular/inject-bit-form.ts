import { signal, computed, inject, DestroyRef } from "@angular/core";
import { useBitStore } from "./provider";

export function injectBitForm<T extends object>() {
  const store = useBitStore<T>();
  const destroyRef = inject(DestroyRef);

  const stateSignal = signal(store.getState());

  const sub = store.subscribe(() => {
    stateSignal.set({ ...store.getState() });
  });

  destroyRef.onDestroy(() => sub());

  const values = computed(() => stateSignal().values);
  const errors = computed(() => stateSignal().errors);
  const touched = computed(() => stateSignal().touched);
  const isValid = computed(() => stateSignal().isValid);
  const isSubmitting = computed(() => stateSignal().isSubmitting);
  const isDirty = computed(() => stateSignal().isDirty);

  const submit = (onSuccess: (values: T) => void | Promise<void>) => {
    return (event?: Event) => {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }
      return store.submit(onSuccess);
    };
  };

  return {
    values,
    errors,
    touched,
    isValid,
    isSubmitting,
    isDirty,
    submit,
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
