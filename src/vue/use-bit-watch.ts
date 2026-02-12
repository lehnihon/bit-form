import { ref, onMounted, onUnmounted, readonly } from 'vue';
import { useBitStore } from './context'; 

export function useBitWatch<T = any>(path: string) {
  const store = useBitStore();
  
  const getDeepValue = (obj: any, p: string) => 
    p.split('.').reduce((acc: any, part) => acc?.[part], obj);

  const value = ref<T>(getDeepValue(store.getState().values, path));

  let unsubscribe: () => void;

  onMounted(() => {
    unsubscribe = store.watch(path, (newValue) => {
      value.value = newValue;
    });
  });

  onUnmounted(() => {
    if (unsubscribe) unsubscribe();
  });

  return readonly(value);
}