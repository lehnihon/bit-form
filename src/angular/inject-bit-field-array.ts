import { DestroyRef, signal, computed, inject } from '@angular/core';
import { useBitStore } from './provider';

const generateId = () => Math.random().toString(36).substring(2, 9);

export function injectBitFieldArray<T = any>(path: string) {
  const store = useBitStore();
  const destroyRef = inject(DestroyRef);

  const getSnapshot = () => {
    const val = path.split('.').reduce((acc: any, part) => acc?.[part], store.getState().values);
    return Array.isArray(val) ? val : [];
  };

  const idsSig = signal<string[]>(getSnapshot().map(generateId));
  const valuesSig = signal<T[]>(getSnapshot());

  const unsub = store.subscribe(() => {
    const newValues = getSnapshot();
    valuesSig.set(newValues);
    
    if (newValues.length !== idsSig().length) {
      idsSig.set(newValues.map(generateId));
    }
  });
  
  destroyRef.onDestroy(unsub);

  const fields = computed(() => {
    const ids = idsSig();
    const vals = valuesSig();
    return vals.map((v, i) => ({ id: ids[i] || generateId(), value: v }));
  });

  return {
    fields,
    append: (val: T) => {
      idsSig.update(ids => [...ids, generateId()]);
      store.pushItem(path, val);
    },
    prepend: (val: T) => {
      idsSig.update(ids => [generateId(), ...ids]);
      store.prependItem(path, val);
    },
    remove: (index: number) => {
      idsSig.update(ids => ids.filter((_, i) => i !== index));
      store.removeItem(path, index);
    },
    insert: (index: number, val: T) => {
      idsSig.update(ids => {
        const copy = [...ids];
        copy.splice(index, 0, generateId());
        return copy;
      });
      store.insertItem(path, index, val);
    },
    move: (from: number, to: number) => {
      idsSig.update(ids => {
        const copy = [...ids];
        const [item] = copy.splice(from, 1);
        copy.splice(to, 0, item);
        return copy;
      });
      store.moveItem(path, from, to);
    },
    swap: (a: number, b: number) => {
      idsSig.update(ids => {
        const copy = [...ids];
        [copy[a], copy[b]] = [copy[b], copy[a]];
        return copy;
      });
      store.swapItems(path, a, b);
    }
  };
}