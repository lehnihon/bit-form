import { signal, computed, inject, DestroyRef } from "@angular/core";
import { useBitStore } from "./provider";
import { isValidationErrorShape, extractServerErrors } from "../core/utils";

export function injectBitForm<T extends object>() {
  const store = useBitStore<T>();
  const destroyRef = inject(DestroyRef);
  const stateSignal = signal({
    isValid: store.getState().isValid,
    isSubmitting: store.getState().isSubmitting,
    isDirty: store.getState().isDirty,
  });
  const submitError = signal<Error | null>(null);
  const lastResponse = signal<unknown>(null);

  const sub = store.subscribeSelector(
    (state) => ({
      isValid: state.isValid,
      isSubmitting: state.isSubmitting,
      isDirty: state.isDirty,
    }),
    (nextState) => {
      stateSignal.set(nextState);
    },
  );

  destroyRef.onDestroy(() => sub());

  const isValid = computed(() => stateSignal().isValid);
  const isSubmitting = computed(() => stateSignal().isSubmitting);
  const isDirty = computed(() => stateSignal().isDirty);

  const getValues = () => store.getState().values;
  const getErrors = () => store.getState().errors;
  const getTouched = () => store.getState().touched;
  const getDirtyValues = () => store.getDirtyValues();

  const submit = (
    onSuccess: (values: T, dirtyValues?: Partial<T>) => void | Promise<void>,
  ) => {
    return (event?: Event) => {
      event?.preventDefault();
      event?.stopPropagation();
      return store.submit(onSuccess);
    };
  };

  const onSubmit = (
    handler: (values: T, dirtyValues?: Partial<T>) => Promise<unknown>,
  ) => {
    return (event?: Event) => {
      event?.preventDefault();
      event?.stopPropagation();
      submitError.set(null);
      return store.submit(async (values, dirtyValues) => {
        try {
          const result = await handler(values, dirtyValues);
          lastResponse.set(result);
          submitError.set(null);
        } catch (err) {
          if (isValidationErrorShape(err)) {
            store.setServerErrors(extractServerErrors(err));
          } else {
            submitError.set(
              err instanceof Error ? err : new Error(String(err)),
            );
          }
        }
      });
    };
  };

  const reset = () => {
    store.reset();
    submitError.set(null);
    lastResponse.set(null);
  };

  const meta = {
    isValid,
    isDirty,
    isSubmitting,
    submitError: submitError.asReadonly(),
    lastResponse: lastResponse.asReadonly(),
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
    submit,
    onSubmit,
    reset,
    replaceValues: store.replaceValues.bind(store),
    hydrate: store.hydrate.bind(store),
    rebase: store.rebase.bind(store),
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
