import { DestroyRef, signal, computed, inject, untracked } from "@angular/core";
import { BIT_STORE_TOKEN } from "./provider";
import {
  getDeepValue,
  BitArrayPath,
  BitPathValue,
  BitArrayItem,
  BitPath,
} from "../core";

export function injectBitArray<
  TForm extends object = any,
  P extends BitArrayPath<TForm> = BitArrayPath<TForm>,
>(path: P) {
  const store = inject(BIT_STORE_TOKEN);
  const destroyRef = inject(DestroyRef);

  const createId = (index?: number) =>
    store.config.idFactory({
      scope: "array",
      path: path as string,
      index,
    });

  const getRaw = () => {
    const val = getDeepValue(
      store.getState().values,
      path as string,
    ) as BitPathValue<TForm, P>;
    return Array.isArray(val)
      ? (val as BitArrayItem<BitPathValue<TForm, P>>[])
      : [];
  };

  const valuesSig = signal<BitArrayItem<BitPathValue<TForm, P>>[]>(getRaw());
  const idsSig = signal<string[]>(
    valuesSig().map((_, index) => createId(index)),
  );

  const unsub = store.subscribePath(path, (value) => {
    const next = Array.isArray(value)
      ? (value as BitArrayItem<BitPathValue<TForm, P>>[])
      : [];
    const ids = untracked(idsSig);
    valuesSig.set(next);

    if (next.length !== ids.length) {
      if (next.length > ids.length) {
        idsSig.set([
          ...ids,
          ...Array.from({ length: next.length - ids.length }, (_, i) =>
            createId(ids.length + i),
          ),
        ]);
      } else {
        idsSig.set(ids.slice(0, next.length));
      }
    }
  });

  destroyRef.onDestroy(() => {
    unsub();
    if (store.unregisterPrefix) store.unregisterPrefix(`${path as string}.`);
  });

  return {
    fields: computed(() =>
      valuesSig().map((v, i) => ({
        key: idsSig()[i] || `temp-${i}`,
        value: v,
        index: i,
      })),
    ),
    length: computed(() => valuesSig().length),
    append: (v: BitArrayItem<BitPathValue<TForm, P>>) => {
      idsSig.update((ids) => [...ids, createId(ids.length)]);
      store.pushItem(path, v);
    },
    prepend: (v: BitArrayItem<BitPathValue<TForm, P>>) => {
      idsSig.update((ids) => [createId(0), ...ids]);
      store.prependItem(path, v);
    },
    remove: (i: number) => {
      idsSig.update((ids) => ids.filter((_, idx) => idx !== i));
      store.removeItem(path, i);
    },
    insert: (index: number, v: BitArrayItem<BitPathValue<TForm, P>>) => {
      idsSig.update((ids) => {
        const c = [...ids];
        c.splice(index, 0, createId(index));
        return c;
      });
      store.insertItem(path, index, v);
    },
    swap: (a: number, b: number) => {
      idsSig.update((ids) => {
        const c = [...ids];
        [c[a], c[b]] = [c[b], c[a]];
        return c;
      });
      store.swapItems(path, a, b);
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
    replace: (items: BitArrayItem<BitPathValue<TForm, P>>[]) => {
      idsSig.set(items.map((_, index) => createId(index)));
      store.setField(
        path as unknown as BitPath<TForm>,
        items as unknown as BitPathValue<TForm, BitPath<TForm>>,
      );
    },
    clear: () => {
      idsSig.set([]);
      store.setField(
        path as unknown as BitPath<TForm>,
        [] as unknown as BitPathValue<TForm, BitPath<TForm>>,
      );
    },
  };
}
