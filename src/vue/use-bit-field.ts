import { computed, onUnmounted, shallowRef } from "vue";
import { useBitStore } from "./context";
import { BitMask, getDeepValue } from "../core"; // Importando do core compartilhado

export interface UseBitFieldOptions {
  mask?: string | BitMask;
  unmask?: boolean;
}

export function useBitField<T = any>(
  path: string,
  options?: UseBitFieldOptions,
) {
  const store = useBitStore();

  // 1. Configuração de Máscara (Igual ao React/Angular)
  let activeMask: BitMask | undefined;
  if (options?.mask) {
    if (typeof options.mask === "string") {
      activeMask = store.masks?.[options.mask];
    } else {
      activeMask = options.mask;
    }
  }

  const shouldUnmask = options?.unmask ?? store.defaultUnmask ?? true;

  // 2. Estado Reativo (Bridge)
  // Usamos shallowRef pois a store já é imutável. Não precisamos de reatividade profunda do Vue aqui.
  const state = shallowRef(store.getState());

  const unsubscribe = store.subscribe(() => {
    // Atualiza a referência para disparar os computeds
    state.value = { ...store.getState() };
  });

  onUnmounted(unsubscribe);

  // 3. Computed Principal (V-Model Ready)
  // O 'get' formata para visualização, o 'set' limpa para armazenamento
  const value = computed({
    get: () => {
      const rawValue = getDeepValue(state.value.values, path) as T;

      if (activeMask && rawValue !== undefined && rawValue !== null) {
        // Se unmask=true (store limpa), formatamos para mostrar
        return activeMask.format(rawValue);
      }
      return rawValue;
    },
    set: (val: T) => {
      if (activeMask) {
        // Se unmask=true, limpamos antes de salvar. Se false, salvamos sujo.
        const valueToSave = shouldUnmask
          ? activeMask.parse(String(val))
          : activeMask.format(val);

        store.setField(path, valueToSave);
      } else {
        store.setField(path, val);
      }
    },
  });

  // 4. Metadados de Validação
  const error = computed(() => {
    const currentErrors = state.value.errors;
    const currentTouched = state.value.touched;
    return currentTouched[path] ? currentErrors[path] : undefined;
  });

  const touched = computed(() => !!state.value.touched[path]);

  const invalid = computed(() => !!(touched.value && error.value));

  // 5. Helpers
  const setBlur = () => store.blurField(path);

  return {
    value,
    error,
    touched,
    invalid,
    setBlur,
    setValue: (val: T) => (value.value = val),
  };
}
