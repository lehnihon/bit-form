import { getDeepValue, reindexFieldArrayMeta } from "../../../utils";
import type { BitFieldChangeMeta, BitState } from "../../contracts/types";
import {
  BitStoreOperation,
  patchStateOperation,
} from "../../engines/operation-engine";
import { toPathPrefix } from "../../shared/path-prefix";

export interface BitArrayStorePort<T extends object> {
  getState: () => BitState<T>;
  setFieldWithMeta: (
    path: string,
    value: unknown,
    meta: BitFieldChangeMeta,
  ) => void;
  dispatch: (operation: BitStoreOperation<T>) => void;
  internalSaveSnapshot: () => void;
  createArrayItemId: (path: string, index?: number) => string;
  unregisterPrefix?: (prefix: string) => void;
}

export class BitArrayManager<T extends object = Record<string, unknown>> {
  private readonly pathIds = new Map<string, string[]>();

  constructor(private store: BitArrayStorePort<T>) {}

  getItemIds(path: string, length?: number): string[] {
    const targetLength =
      typeof length === "number"
        ? Math.max(0, length)
        : this.getCurrentArrayLength(path);

    return [...this.ensureIds(path, targetLength)];
  }

  pushItem(path: string, value: unknown) {
    this.withPathIds(path, (ids) => {
      ids.push(this.store.createArrayItemId(path, ids.length));
      return ids;
    });

    this.mutateArrayWithSetField(path, (arr) => [...arr, value], {
      origin: "array",
      operation: "push",
    });
  }

  prependItem(path: string, value: unknown) {
    this.withPathIds(path, (ids) => {
      ids.unshift(this.store.createArrayItemId(path, 0));
      return ids;
    });

    this.store.unregisterPrefix?.(toPathPrefix(path));

    const current =
      (getDeepValue(this.store.getState().values, path) as
        | unknown[]
        | undefined) ?? [];
    this.commitArrayMutationWithFieldPipeline({
      path,
      nextArray: [value, ...current],
      meta: { origin: "array", operation: "prepend" },
      reindex: (currentIdx) => currentIdx + 1,
    });
  }

  insertItem(path: string, index: number, value: unknown) {
    const currentLength = this.getCurrentArrayLength(path);
    const safeIndex = Math.max(0, Math.min(index, currentLength));

    this.withPathIds(path, (ids) => {
      const next = [...ids];
      next.splice(safeIndex, 0, this.store.createArrayItemId(path, safeIndex));
      return next;
    });

    if (this.store.unregisterPrefix) {
      for (let i = safeIndex; i < currentLength; i++) {
        this.store.unregisterPrefix(toPathPrefix(path, i));
      }
    }

    const current = (getDeepValue(this.store.getState().values, path) as unknown[] | undefined) ?? [];
    const nextArray = [...current];
    nextArray.splice(safeIndex, 0, value);

    this.commitArrayMutationWithFieldPipeline({
      path,
      nextArray,
      meta: { origin: "array", operation: "insert", index: safeIndex },
      reindex: (currentIdx) => currentIdx < safeIndex ? currentIdx : currentIdx + 1,
    });
  }

  removeItem(path: string, index: number) {
    const state = this.store.getState();
    const arr = getDeepValue(state.values, path);
    if (!Array.isArray(arr)) return;
    if (index < 0 || index >= arr.length) return;

    this.withPathIds(path, (ids) => {
      const next = [...ids];
      next.splice(index, 1);
      return next;
    });

    if (this.store.unregisterPrefix) {
      this.store.unregisterPrefix(toPathPrefix(path, index));
    }

    const newArray = arr.filter((_, i) => i !== index);

    this.commitArrayMutationWithFieldPipeline({
      path,
      nextArray: newArray,
      meta: { origin: "array", operation: "remove", index },
      reindex: (currentIdx) => {
        if (currentIdx === index) {
          return null;
        }

        return currentIdx > index ? currentIdx - 1 : currentIdx;
      },
    });
  }

  swapItems(path: string, indexA: number, indexB: number) {
    const state = this.store.getState();
    const source = getDeepValue(state.values, path);
    if (!Array.isArray(source)) return;
    if (indexA < 0 || indexA >= source.length) return;
    if (indexB < 0 || indexB >= source.length) return;

    this.withPathIds(path, (ids) => {
      const next = [...ids];
      [next[indexA], next[indexB]] = [next[indexB], next[indexA]];
      return next;
    });

    const arr = [...source];
    [arr[indexA], arr[indexB]] = [arr[indexB], arr[indexA]];

    if (this.store.unregisterPrefix) {
      this.store.unregisterPrefix(toPathPrefix(path, indexA));
      this.store.unregisterPrefix(toPathPrefix(path, indexB));
    }

    this.commitArrayMutationWithFieldPipeline({
      path,
      nextArray: arr,
      meta: {
        origin: "array",
        operation: "swap",
        from: indexA,
        to: indexB,
      },
      reindex: (currentIdx) => {
        if (currentIdx === indexA) {
          return indexB;
        }

        if (currentIdx === indexB) {
          return indexA;
        }

        return currentIdx;
      },
    });
  }

  moveItem(path: string, from: number, to: number) {
    const state = this.store.getState();
    const source = getDeepValue(state.values, path);
    if (!Array.isArray(source)) return;
    if (from < 0 || from >= source.length) return;
    if (to < 0 || to >= source.length) return;

    this.withPathIds(path, (ids) => {
      const next = [...ids];
      const [id] = next.splice(from, 1);
      next.splice(to, 0, id);
      return next;
    });

    const arr = [...source];
    const [item] = arr.splice(from, 1);
    arr.splice(to, 0, item);

    if (this.store.unregisterPrefix) {
      const minIndex = Math.min(from, to);
      const maxIndex = Math.max(from, to);

      for (let index = minIndex; index <= maxIndex; index += 1) {
        this.store.unregisterPrefix(toPathPrefix(path, index));
      }
    }

    this.commitArrayMutationWithFieldPipeline({
      path,
      nextArray: arr,
      meta: {
        origin: "array",
        operation: "move",
        from,
        to,
      },
      reindex: (currentIdx) => {
        if (currentIdx === from) {
          return to;
        }

        if (from < to && currentIdx > from && currentIdx <= to) {
          return currentIdx - 1;
        }

        if (from > to && currentIdx >= to && currentIdx < from) {
          return currentIdx + 1;
        }

        return currentIdx;
      },
    });
  }

  replaceItems(path: string, items: unknown[]) {
    this.store.unregisterPrefix?.(toPathPrefix(path));

    this.pathIds.set(
      path,
      items.map((_, index) => this.store.createArrayItemId(path, index)),
    );

    this.commitArrayMutationWithFieldPipeline({
      path,
      nextArray: items,
      meta: { origin: "array", operation: "replace" },
      reindex: (currentIdx) => (currentIdx < items.length ? currentIdx : null),
    });
  }

  clearItems(path: string) {
    this.pathIds.set(path, []);

    if (this.store.unregisterPrefix) {
      this.store.unregisterPrefix(toPathPrefix(path));
    }

    this.commitArrayMutationWithFieldPipeline({
      path,
      nextArray: [],
      meta: { origin: "array", operation: "clear" },
      reindex: () => null,
    });
  }

  private mutateArrayWithSetField(
    path: string,
    mutate: (current: unknown[]) => unknown[],
    meta: BitFieldChangeMeta,
  ) {
    const current = getDeepValue(this.store.getState().values, path) || [];
    this.store.setFieldWithMeta(path, mutate(current), meta);
    this.store.internalSaveSnapshot();
  }

  private withPathIds(path: string, updater: (ids: string[]) => string[]) {
    const currentLength = this.getCurrentArrayLength(path);
    const current = this.ensureIds(path, currentLength);
    this.pathIds.set(path, updater(current));
  }

  private ensureIds(path: string, length: number): string[] {
    const current = this.pathIds.get(path) ?? [];

    if (current.length === length) {
      return current;
    }

    if (current.length < length) {
      const next = [...current];
      for (let index = current.length; index < length; index += 1) {
        next.push(this.store.createArrayItemId(path, index));
      }
      this.pathIds.set(path, next);
      return next;
    }

    const next = current.slice(0, length);
    this.pathIds.set(path, next);
    return next;
  }

  private getCurrentArrayLength(path: string): number {
    const value = getDeepValue(this.store.getState().values, path);
    return Array.isArray(value) ? value.length : 0;
  }

  private commitArrayMutationWithFieldPipeline(args: {
    path: string;
    nextArray: unknown[];
    meta: BitFieldChangeMeta;
    reindex: (currentIdx: number) => number | null;
  }) {
    const { path, nextArray, meta, reindex } = args;
    const previousState = this.store.getState();

    this.store.setFieldWithMeta(path, nextArray, meta);

    const reindexedMeta = reindexFieldArrayMeta(previousState, path, reindex);

    this.store.dispatch(
      patchStateOperation(
        {
          errors: reindexedMeta.errors,
          touched: reindexedMeta.touched,
          // Não reindexa isValidating em mutações estruturais de array.
          // Jobs assíncronos ainda em voo finalizam/cancelam no path original,
          // evitando flags órfãs após shift de índice.
          isValidating: previousState.isValidating,
        },
        [path],
      ),
    );

    this.store.internalSaveSnapshot();
  }
}
