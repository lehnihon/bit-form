import { DestroyRef, signal, computed, inject, untracked } from "@angular/core";
import { useBitStore } from "./provider";
import { getDeepValue } from "../core";

const generateId = () => Math.random().toString(36).substring(2, 9);

export function injectBitFieldArray<T = any>(path: string) {
  const store = useBitStore();
  const destroyRef = inject(DestroyRef);

  // 1. Helper para extrair o dado atual
  const getRawArray = () => {
    const val = getDeepValue(store.getState().values, path);
    return Array.isArray(val) ? (val as T[]) : [];
  };

  // 2. Estado reativo local
  const initialData = getRawArray();
  const valuesSig = signal<T[]>(initialData);
  const idsSig = signal<string[]>(initialData.map(generateId));

  // 3. Sincronização Inteligente (Store -> Signal)
  const unsub = store.subscribe(() => {
    const nextValues = getRawArray();
    const currentIds = untracked(idsSig); // Evita dependência circular

    // Atualiza valores
    valuesSig.set(nextValues);

    // Ajusta IDs apenas se necessário, sem regenerar os existentes
    if (nextValues.length !== currentIds.length) {
      if (nextValues.length > currentIds.length) {
        // Adicionou itens: gera IDs apenas para os novos
        const diff = nextValues.length - currentIds.length;
        const newIds = Array.from({ length: diff }, generateId);
        idsSig.set([...currentIds, ...newIds]);
      } else {
        // Removeu itens: corta o excesso
        idsSig.set(currentIds.slice(0, nextValues.length));
      }
    }
  });

  destroyRef.onDestroy(unsub);

  // 4. Mapeamento para o Template
  const fields = computed(() => {
    const vals = valuesSig();
    const ids = idsSig();
    return vals.map((v, i) => ({
      key: ids[i] || generateId(), // Mantém consistência com o 'key' do React
      value: v,
      index: i,
    }));
  });

  // 5. Métodos de Mutação (Otimistas)
  return {
    fields,
    append: (val: T) => {
      idsSig.update((ids) => [...ids, generateId()]);
      store.pushItem(path, val);
    },
    prepend: (val: T) => {
      idsSig.update((ids) => [generateId(), ...ids]);
      store.prependItem(path, val);
    },
    remove: (index: number) => {
      idsSig.update((ids) => ids.filter((_, i) => i !== index));
      store.removeItem(path, index);
    },
    insert: (index: number, val: T) => {
      idsSig.update((ids) => {
        const copy = [...ids];
        copy.splice(index, 0, generateId());
        return copy;
      });
      store.insertItem(path, index, val);
    },
    move: (from: number, to: number) => {
      idsSig.update((ids) => {
        const copy = [...ids];
        const [item] = copy.splice(from, 1);
        copy.splice(to, 0, item);
        return copy;
      });
      store.moveItem(path, from, to);
    },
    swap: (a: number, b: number) => {
      idsSig.update((ids) => {
        const copy = [...ids];
        [copy[a], copy[b]] = [copy[b], copy[a]];
        return copy;
      });
      store.swapItems(path, a, b);
    },
  };
}
