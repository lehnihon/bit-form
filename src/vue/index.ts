import { ref, computed, onUnmounted } from 'vue';
import { BitStore } from '../core/bit-store';

export function useBitField<T extends object>(store: BitStore<T>, path: string) {
  const _trigger = ref(0);

  const unsubscribe = store.subscribe(() => {
    _trigger.value++;
  });

  onUnmounted(() => unsubscribe());

  const getDeepValue = (obj: any, path: string) => {
    return path.split('.').reduce((prev, curr) => prev?.[curr], obj);
  };

  const value = computed({
    get: () => {
      _trigger.value;
      return getDeepValue(store.getState().values, path);
    },
    set: (val) => {
      store.setField(path, val);
    }
  });

  const error = computed(() => {
    _trigger.value;
    const state = store.getState();
    return !!state.touched[path] ? state.errors[path] : undefined;
  });

  const touched = computed(() => {
    _trigger.value;
    return !!store.getState().touched[path];
  });

  return {
    value,
    error,
    touched,
    blur: () => store.blurField(path)
  };
}

export function useBitForm<T extends object>(store: BitStore<T>) {
  const _trigger = ref(0);
  
  const unsubscribe = store.subscribe(() => {
    _trigger.value++;
  });

  onUnmounted(() => unsubscribe());

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
    setField: store.setField.bind(store),
    pushItem: store.pushItem.bind(store),
    removeItem: store.removeItem.bind(store),
    submit: (onSuccess: (values: T) => void | Promise<void>) => {
      return (e?: Event) => {
        if (e?.preventDefault) e.preventDefault();
        return store.submit(onSuccess);
      };
    }
  };
}