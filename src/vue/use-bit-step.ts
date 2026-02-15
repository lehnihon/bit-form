import { ref, onMounted, onUnmounted } from "vue";
import { BitStore } from "../core";

export function useBitStep<T extends object>(
  store: BitStore<T>,
  scopeName: string,
) {
  const status = ref(store.getStepStatus(scopeName));
  let unsubscribe: () => void;

  onMounted(() => {
    unsubscribe = store.subscribe(() => {
      const newStatus = store.getStepStatus(scopeName);
      if (
        newStatus.hasErrors !== status.value.hasErrors ||
        newStatus.isDirty !== status.value.isDirty
      ) {
        status.value = newStatus;
      }
    });
  });

  onUnmounted(() => {
    if (unsubscribe) unsubscribe();
  });

  const validate = async () => {
    return await store.validate({ scope: scopeName });
  };

  return {
    status,
    validate,
  };
}
