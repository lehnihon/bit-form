import { signal, computed, inject, DestroyRef } from '@angular/core';
import { useBitStore } from './provider';

export function injectBitField<T = any>(path: string) {
  const store = useBitStore();
  
  const stateSignal = signal(store.getState());

  const sub = store.subscribe(() => {
    stateSignal.set({ ...store.getState() });
  });

  inject(DestroyRef).onDestroy(() => sub());

  const getDeepValue = (obj: any, p: string) => 
    p.split('.').reduce((prev, curr) => prev?.[curr], obj);

  const value = computed(() => getDeepValue(stateSignal().values, path) as T);
  
  const error = computed(() => {
    const state = stateSignal();
    return state.touched[path] ? state.errors[path] : undefined;
  });

  const touched = computed(() => !!stateSignal().touched[path]);

  return {
    value,
    error,
    touched,
    setValue: (val: T) => store.setField(path, val),
    setBlur: () => store.blurField(path)
  };
}