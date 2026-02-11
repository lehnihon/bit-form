import { ref, onMounted, onUnmounted, computed, readonly } from 'vue';
import { BitStore } from '../core/bit-store';

export function useBitField<T extends Record<string, any>, K extends keyof T>(
  store: BitStore<T>,
  fieldName: K
) {
  // 1. Criamos refs para os estados que o Vue precisa observar
  const value = ref<T[K]>(store.getState()[fieldName]);
  const errorMsg = ref<string | undefined>(store.getErrors()[fieldName]);
  const isTouched = ref<boolean>(!!store.getTouched()[fieldName]);

  // 2. Sincronizamos com a store
  let unsubscribe: () => void;

  onMounted(() => {
    unsubscribe = store.subscribe(() => {
      value.value = store.getState()[fieldName];
      errorMsg.value = store.getErrors()[fieldName];
      isTouched.value = !!store.getTouched()[fieldName];
    });
  });

  onUnmounted(() => {
    if (unsubscribe) unsubscribe();
  });

  return {
    // Retornamos refs para manter a reatividade no template
    value,
    // Erro derivado (computed)
    error: computed(() => isTouched.value ? errorMsg.value : undefined),
    
    setValue: (val: T[K]) => store.setState({ [fieldName]: val } as any),
    onBlur: () => store.markTouched(fieldName)
  };
}

export function useBitFormStatus(store: BitStore<any>) {
  const isDirty = ref(store.isDirty());
  const isValidating = ref(store.isValidating);

  let unsubscribe: () => void;

  onMounted(() => {
    unsubscribe = store.subscribe(() => {
      isDirty.value = store.isDirty();
      isValidating.value = store.isValidating;
    });
  });

  onUnmounted(() => {
    if (unsubscribe) unsubscribe();
  });

  return {
    isDirty: readonly(isDirty),
    isValidating: readonly(isValidating),
    reset: () => store.reset()
  };
}