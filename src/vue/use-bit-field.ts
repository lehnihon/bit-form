import { computed, onUnmounted, shallowRef } from "vue";
import { useBitStore } from "./context";
import { BitMask, getDeepValue } from "../core";

export interface UseBitFieldOptions {
  mask?: string | BitMask;
  unmask?: boolean;
}

export function useBitField<T = any>(
  path: string,
  options?: UseBitFieldOptions,
) {
  const store = useBitStore();

  // 1. Resolução da Máscara (Estática por render, igual ao React)
  const resolvedMask = options?.mask
    ? typeof options.mask === "string"
      ? store.masks?.[options.mask]
      : options.mask
    : undefined;

  const shouldUnmask = options?.unmask ?? store.defaultUnmask ?? true;

  // 2. Estado Reativo (Bridge manual Store -> Vue)
  // Usamos shallowRef para conectar o estado externo da BitStore ao sistema de reatividade do Vue
  const state = shallowRef(store.getState());

  const unsubscribe = store.subscribe(() => {
    // Força a atualização do ref substituindo o objeto (imutabilidade da store ajuda aqui)
    state.value = store.getState();
  });

  onUnmounted(unsubscribe);

  // 3. Computed para Leitura (Raw Value)
  const rawValue = computed(() => {
    return getDeepValue(state.value.values, path) as T;
  });

  // 4. Computed para Exibição (Display Value) - CRUCIAL PARA O TESTE
  const displayValue = computed(() => {
    const val = rawValue.value;
    if (val === undefined || val === null) return "";

    if (resolvedMask) {
      // Se tiver máscara, formata. Se shouldUnmask for false, assume que já está formatado,
      // mas formatar novamente garante consistência visual.
      return resolvedMask.format(val);
    }
    return String(val);
  });

  // 5. Computed Principal (V-Model Ready)
  // Get: Mostra formatado | Set: Salva parseado (raw)
  const value = computed({
    get: () => displayValue.value,
    set: (val: any) => {
      if (!resolvedMask) {
        store.setField(path, val);
        return;
      }

      if (shouldUnmask) {
        // Unmask: Parseia o valor (ex: tira R$, pontuação) e salva puro
        store.setField(path, resolvedMask.parse(String(val)));
      } else {
        // Mask: Salva o valor formatado na store
        store.setField(path, resolvedMask.format(String(val)));
      }
    },
  });

  // 6. Metadados de Validação
  const error = computed(() => {
    return state.value.touched[path] ? state.value.errors[path] : undefined;
  });

  const touched = computed(() => !!state.value.touched[path]);
  const invalid = computed(() => !!(touched.value && error.value));

  // 7. Helpers
  const setBlur = () => store.blurField(path);

  return {
    value, // Bind no v-model
    displayValue, // <-- O que faltava para o teste passar
    error,
    touched,
    invalid,
    setBlur,
    setValue: (val: T) => (value.value = val), // Setter manual se necessário
  };
}
