import type { BitFieldChangeMeta, BitState } from "../../contracts/types";
import { getDeepValue, reindexFieldArrayMeta } from "../../../utils";
import { toPathPrefix } from "../../shared/path-prefix";
import {
  BitStoreOperation,
  patchStateOperation,
} from "../../engines/operation-engine";

export interface BitArrayStorePort<T extends object> {
  getState: () => BitState<T>;
  setFieldWithMeta: (
    path: string,
    value: unknown,
    meta: BitFieldChangeMeta,
  ) => void;
  dispatch: (operation: BitStoreOperation<T>) => void;
  internalSaveSnapshot: () => void;
  unregisterPrefix?: (prefix: string) => void;
}

export class BitArrayManager<T extends object = Record<string, unknown>> {
  constructor(private store: BitArrayStorePort<T>) {}

  pushItem(path: string, value: unknown) {
    this.mutateArrayWithSetField(path, (arr) => [...arr, value], {
      origin: "array",
      operation: "push",
    });
  }

  prependItem(path: string, value: unknown) {
    this.mutateArrayWithSetField(path, (arr) => [value, ...arr], {
      origin: "array",
      operation: "prepend",
    });
  }

  insertItem(path: string, index: number, value: unknown) {
    this.mutateArrayWithSetField(
      path,
      (arr) => {
        const next = [...arr];
        next.splice(index, 0, value);
        return next;
      },
      {
        origin: "array",
        operation: "insert",
        index,
      },
    );
  }

  removeItem(path: string, index: number) {
    const state = this.store.getState();
    const arr = getDeepValue(state.values, path);
    if (!Array.isArray(arr)) return;

    const previousArray = [...arr];

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
    const arr = [...(getDeepValue(state.values, path) || [])];
    [arr[indexA], arr[indexB]] = [arr[indexB], arr[indexA]];

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
    const arr = [...(getDeepValue(state.values, path) || [])];
    const [item] = arr.splice(from, 1);
    arr.splice(to, 0, item);

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
    this.commitArrayMutationWithFieldPipeline({
      path,
      nextArray: items,
      meta: { origin: "array", operation: "replace" },
      reindex: (currentIdx) => (currentIdx < items.length ? currentIdx : null),
    });
  }

  clearItems(path: string) {
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
          isValidating: reindexedMeta.isValidating,
        },
        [path],
      ),
    );

    this.store.internalSaveSnapshot();
  }
}
