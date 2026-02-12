import { signal, computed, inject, DestroyRef } from '@angular/core';
import { BitStore } from '../core/bit-store';

export function injectBitField<T extends object>(store: BitStore<T>, path: string) {
  const stateSignal = signal(store.getState());

  const sub = store.subscribe(() => {
    stateSignal.set(store.getState());
  });

  try {
    inject(DestroyRef).onDestroy(() => sub());
  } catch (e) {
    console.warn('injectBitField must be called in an injection context (constructor or field initializer).');
  }

  const getDeepValue = (obj: any, path: string) => {
    return path.split('.').reduce((prev, curr) => prev?.[curr], obj);
  };

  const value = computed(() => getDeepValue(stateSignal().values, path));
  
  const error = computed(() => {
    const state = stateSignal();
    const isTouched = !!state.touched[path];
    return isTouched ? state.errors[path] : undefined;
  });

  const touched = computed(() => !!stateSignal().touched[path]);

  return {
    value,
    error,
    touched,
    setValue: (val: any) => store.setField(path, val),
    blur: () => store.blurField(path)
  };
}

export function injectBitForm<T extends object>(store: BitStore<T>) {
  const stateSignal = signal(store.getState());

  const sub = store.subscribe(() => {
    stateSignal.set(store.getState());
  });

  try {
    inject(DestroyRef).onDestroy(() => sub());
  } catch (e) {
    console.warn('injectBitForm must be called in an injection context.');
  }

  const values = computed(() => stateSignal().values);
  const errors = computed(() => stateSignal().errors);
  const touched = computed(() => stateSignal().touched);
  const isValid = computed(() => stateSignal().isValid);
  const isSubmitting = computed(() => stateSignal().isSubmitting);

  return {
    values,
    errors,
    touched,
    isValid,
    isSubmitting,
    setField: store.setField.bind(store),
    pushItem: store.pushItem.bind(store),
    removeItem: store.removeItem.bind(store),
    submit: (onSuccess: (values: T) => void | Promise<void>) => {
      return (event?: Event) => {
        if (event?.preventDefault) event.preventDefault();
        return store.submit(onSuccess);
      };
    }
  };
}