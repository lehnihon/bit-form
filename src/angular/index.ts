import { signal, computed, inject, DestroyRef, Signal } from '@angular/core';
import { BitFormStore } from '../core/bit-store';

export function createBitSignal<T extends Record<string, any>, K extends keyof T>(
  store: BitFormStore<T>,
  fieldName: K
) {
  // 1. Uso do Signal (como tipo) e signal (como valor)
  const fieldSignal = signal<T[K]>(store.getState()[fieldName]);
  const errorSignal = signal<string | undefined>(store.getErrors()[fieldName]);
  const touchedSignal = signal<boolean>(!!store.getTouched()[fieldName]);

  // 2. Injetamos o DestroyRef para limpeza automática (substitui o onDestroy manual)
  // Isso garante que o subscribe seja cancelado quando o componente for destruído
  try {
    const destroyRef = inject(DestroyRef);
    const unsubscribe = store.subscribe(() => {
      fieldSignal.set(store.getState()[fieldName]);
      errorSignal.set(store.getErrors()[fieldName]);
      touchedSignal.set(!!store.getTouched()[fieldName]);
    });
    destroyRef.onDestroy(() => unsubscribe());
  } catch (e) {
    console.warn('BitForm: createBitSignal deve ser chamado em um contexto de injeção (constructor/field init).');
  }

  return {
    // Retornamos como Signal readonly para manter a integridade
    value: fieldSignal.asReadonly() as Signal<T[K]>,
    
    // 3. Uso do computed para lógica derivada
    error: computed(() => touchedSignal() ? errorSignal() : undefined),
    
    setValue: (val: T[K]) => store.setState({ [fieldName]: val } as any),
    onBlur: () => store.markTouched(fieldName)
  };
}

export function useBitFormStatus(store: BitFormStore<any>) {
  const isDirty = signal(store.isDirty());
  const isValidating = signal(store.isValidating);

  try {
    const destroyRef = inject(DestroyRef);
    const unsubscribe = store.subscribe(() => {
      isDirty.set(store.isDirty());
      isValidating.set(store.isValidating);
    });
    destroyRef.onDestroy(() => unsubscribe());
  } catch (e) {}

  return {
    isDirty: isDirty.asReadonly(),
    isValidating: isValidating.asReadonly(),
    reset: () => store.reset()
  };
}