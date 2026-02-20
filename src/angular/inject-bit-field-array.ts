import { DestroyRef, signal, computed, inject, untracked } from "@angular/core";
import { BIT_STORE_TOKEN } from "./provider";
import { getDeepValue } from "../core";

const generateId = () => Math.random().toString(36).substring(2, 9);

export function injectBitFieldArray<T = any>(path: string) {
  const store = inject(BIT_STORE_TOKEN);
  const destroyRef = inject(DestroyRef);

  const getRaw = () => {
    const val = getDeepValue(store.getState().values, path);
    return Array.isArray(val) ? (val as T[]) : [];
  };

  const valuesSig = signal<T[]>(getRaw());
  const idsSig = signal<string[]>(valuesSig().map(generateId));

  const unsub = store.subscribe(() => {
    const next = getRaw();
    const ids = untracked(idsSig);
    valuesSig.set(next);

    if (next.length !== ids.length) {
      if (next.length > ids.length) {
        idsSig.set([
          ...ids,
          ...Array.from({ length: next.length - ids.length }, generateId),
        ]);
      } else {
        idsSig.set(ids.slice(0, next.length));
      }
    }
  });

  destroyRef.onDestroy(() => {
    unsub();
    if (store.unregisterPrefix) store.unregisterPrefix(`${path}.`);
  });

  return {
    fields: computed(() =>
      valuesSig().map((v, i) => ({
        key: idsSig()[i] || `temp-${i}`,
        value: v,
        index: i,
      })),
    ),
    append: (v: T) => {
      idsSig.update((ids) => [...ids, generateId()]);
      store.pushItem(path, v);
    },
    prepend: (v: T) => {
      idsSig.update((ids) => [generateId(), ...ids]);
      store.prependItem(path, v);
    },
    remove: (i: number) => {
      idsSig.update((ids) => ids.filter((_, idx) => idx !== i));
      store.removeItem(path, i);
    },
    move: (f: number, t: number) => {
      idsSig.update((ids) => {
        const c = [...ids];
        const [it] = c.splice(f, 1);
        c.splice(t, 0, it);
        return c;
      });
      store.moveItem(path, f, t);
    },
    replace: (items: T[]) => {
      idsSig.set(items.map(() => generateId()));
      store.setField(path, items);
    },

    clear: () => {
      idsSig.set([]);
      store.setField(path, []);
    },
  };
}
