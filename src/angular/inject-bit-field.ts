import { signal, computed, inject, DestroyRef } from "@angular/core";
import { useBitStore } from "./provider"; // Assumindo que você tem isso
import { BitMask, getDeepValue } from "../core"; // Importando do core compartilhado

export interface UseBitFieldOptions {
  mask?: BitMask | string;
  unmask?: boolean;
}

export function injectBitField<T = any>(
  path: string,
  options?: UseBitFieldOptions,
) {
  const store = useBitStore();
  const destroyRef = inject(DestroyRef);

  // 1. Resolve a Máscara (Registry Global ou Objeto Local)
  // No Angular não temos useMemo, fazemos direto pois a func roda no injection context
  let activeMask: BitMask | undefined;
  const maskOption = options?.mask;

  if (maskOption) {
    if (typeof maskOption === "string") {
      activeMask = store.masks?.[maskOption];
      if (!activeMask) {
        console.warn(`[BitForm] Máscara '${maskOption}' não encontrada.`);
      }
    } else {
      activeMask = maskOption;
    }
  }

  // 2. Resolve a Configuração de Limpeza
  const shouldUnmask = options?.unmask ?? store.defaultUnmask ?? true;

  // 3. Estado Reativo (Signal Central)
  const state = signal(store.getState());

  // Sincroniza Store -> Signal
  const unsubscribe = store.subscribe(() => {
    // Atualizamos o signal com uma cópia rasa para disparar os computeds
    state.set({ ...store.getState() });
  });

  // Limpeza automática ao destruir o componente
  destroyRef.onDestroy(() => unsubscribe());

  // 4. Computeds (Seletores de Leitura)

  // Valor cru da store (Raw Value)
  const rawValue = computed(() => getDeepValue(state().values, path) as T);

  // Valor para exibir no Input (Display Value)
  const displayValue = computed(() => {
    const val = rawValue();
    if (val === undefined || val === null) return "";

    if (activeMask) {
      // Se unmask=true (store limpa), formatamos para mostrar
      // Se unmask=false (store suja), mostramos direto
      return shouldUnmask ? activeMask.format(val) : String(val);
    }
    return val;
  });

  const error = computed(() => {
    const s = state();
    return s.touched[path] ? s.errors[path] : undefined;
  });

  const touched = computed(() => !!state().touched[path]);
  const invalid = computed(() => !!(touched() && error()));

  // 5. Métodos de Escrita (Actions)

  const setValue = (val: any) => {
    if (!activeMask) {
      store.setField(path, val);
      return;
    }

    if (shouldUnmask) {
      store.setField(path, activeMask.parse(val)); // Salva limpo
    } else {
      store.setField(path, activeMask.format(val)); // Salva formatado
    }
  };

  const setBlur = () => {
    store.blurField(path);
  };

  // Helper para facilitar o binding no template (HTML)
  // Ex: (input)="onInput($event)"
  const onInput = (event: Event) => {
    const target = event.target as HTMLInputElement;
    setValue(target.value);
  };

  return {
    // Sinais de leitura
    value: rawValue, // Valor real (store)
    displayValue, // Valor formatado (view)
    error,
    touched,
    invalid,

    // Métodos
    setValue,
    setBlur,
    onInput, // Facilitador para eventos do DOM

    // Objeto props para spread (se o Angular suportar no futuro ou via diretiva customizada)
    props: {
      value: displayValue,
      onBlur: setBlur,
      onInput: onInput,
    },
  };
}
