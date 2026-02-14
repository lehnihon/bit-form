import { signal, computed, inject, DestroyRef } from "@angular/core";
import { useBitStore } from "./provider";

export function injectBitForm<T extends object>() {
  const store = useBitStore<T>();
  const destroyRef = inject(DestroyRef);
  const stateSignal = signal(store.getState());

  const sub = store.subscribe(() => {
    stateSignal.set(store.getState());
  });

  destroyRef.onDestroy(() => sub());

  const isValid = computed(() => stateSignal().isValid);
  const isSubmitting = computed(() => stateSignal().isSubmitting);
  const isDirty = computed(() => stateSignal().isDirty);

  const canUndo = computed(() => {
    stateSignal();
    return store.canUndo;
  });

  const canRedo = computed(() => {
    stateSignal();
    return store.canRedo;
  });

  const getValues = () => stateSignal().values;
  const getErrors = () => stateSignal().errors;
  const getTouched = () => stateSignal().touched;

  const submit = (onSuccess: (values: T) => void | Promise<void>) => {
    return (event?: Event) => {
      event?.preventDefault();
      event?.stopPropagation();
      return store.submit(onSuccess);
    };
  };

  return {
    store,
    isValid,
    isSubmitting,
    isDirty,
    canUndo,
    canRedo,
    getValues,
    getErrors,
    getTouched,
    submit,
    reset: store.reset.bind(store),
    validate: store.validate.bind(store),
    setValues: store.setValues.bind(store),
    setError: store.setError.bind(store),
    setErrors: store.setErrors.bind(store),
    setServerErrors: store.setServerErrors.bind(store),
    setField: store.setField.bind(store),
    blurField: store.blurField.bind(store),
    registerMask: store.registerMask.bind(store),
    pushItem: store.pushItem.bind(store),
    prependItem: store.prependItem.bind(store),
    removeItem: store.removeItem.bind(store),
    insertItem: store.insertItem.bind(store),
    moveItem: store.moveItem.bind(store),
    swapItems: store.swapItems.bind(store),
    undo: store.undo.bind(store),
    redo: store.redo.bind(store),
  };
}
