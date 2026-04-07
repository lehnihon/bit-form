import { computed, onMounted, onUnmounted, ref } from "vue";
import type {
  BitFrameworkStoreApi,
  BitStoreApi,
  ScopeStatus,
  ValidateScopeResult,
} from "../core";
import { observeScopeStatusSnapshot } from "../core";
import { resolveVueStore } from "./store";

export type { ScopeStatus, ValidateScopeResult };

export function useBitScope<T extends object = any>(
  storeInput: BitFrameworkStoreApi<T> | BitStoreApi<T>,
  scopeName: string,
) {
  const store = resolveVueStore(storeInput);
  const status = ref<ScopeStatus>(store.read.getScopeStatus(scopeName));
  let unsubscribe: () => void;

  onMounted(() => {
    unsubscribe = observeScopeStatusSnapshot(store, scopeName, (nextStatus) => {
      status.value = nextStatus;
    });
  });

  onUnmounted(() => {
    unsubscribe?.();
  });

  const validate = async (): Promise<ValidateScopeResult> => {
    const valid = await store.feature.validate({ scope: scopeName });
    const errors = store.read.getScopeErrors(scopeName);
    return { valid, errors };
  };

  const getErrors = () => store.read.getScopeErrors(scopeName);

  const isValid = computed(() => !status.value.hasErrors);
  const isDirty = computed(() => status.value.isDirty);
  const errors = computed(() => status.value.errors);

  return {
    scopeName,
    status,
    errors,
    validate,
    getErrors,
    isValid,
    isDirty,
  };
}
