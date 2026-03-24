import type {
  BitFieldChangeEvent,
  BitFieldChangeMeta,
  BitState,
} from "../../contracts/types";
import {
  getDeepValue,
  setDeepValue,
  reindexFieldArrayMeta,
} from "../../../utils";
import {
  BitStoreOperation,
  patchStateOperation,
} from "../../engines/operation-engine";

export interface BitArrayStorePort<T extends object> {
  getState: () => BitState<T>;
  setFieldWithMeta: (
    path: string,
    value: any,
    meta: BitFieldChangeMeta,
  ) => void;
  emitFieldChange: (event: BitFieldChangeEvent<T>) => void;
  dispatch: (operation: BitStoreOperation<T>) => void;
  internalSaveSnapshot: () => void;
  unregisterPrefix?: (prefix: string) => void;
  triggerValidation: (scopeFields?: string[]) => void;
  updateDirtyForPath: (
    path: string,
    nextValues: T,
    baselineValues: T,
  ) => boolean;
  getConfig: () => Readonly<{ initialValues: T }>;
}

export class BitArrayManager<T extends object = any> {
  constructor(private store: BitArrayStorePort<T>) {}

  pushItem(path: string, value: any) {
    this.mutateArrayWithSetField(path, (arr) => [...arr, value], {
      origin: "array",
      operation: "push",
    });
  }

  prependItem(path: string, value: any) {
    this.mutateArrayWithSetField(path, (arr) => [value, ...arr], {
      origin: "array",
      operation: "prepend",
    });
  }

  insertItem(path: string, index: number, value: any) {
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
      this.store.unregisterPrefix(`${path}.${index}.`);
    }

    const newArray = arr.filter((_, i) => i !== index);

    this.commitReindexedArrayMutation({
      path,
      previousArray,
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
    const previousArray = [...arr];
    [arr[indexA], arr[indexB]] = [arr[indexB], arr[indexA]];

    this.commitReindexedArrayMutation({
      path,
      previousArray,
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
    const previousArray = [...arr];
    const [item] = arr.splice(from, 1);
    arr.splice(to, 0, item);

    this.commitReindexedArrayMutation({
      path,
      previousArray,
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

  private revalidate(path: string) {
    this.store.triggerValidation([path]);
  }

  private mutateArrayWithSetField(
    path: string,
    mutate: (current: any[]) => any[],
    meta: BitFieldChangeMeta,
  ) {
    const current = getDeepValue(this.store.getState().values, path) || [];
    this.store.setFieldWithMeta(path, mutate(current), meta);
    this.store.internalSaveSnapshot();
  }

  private commitReindexedArrayMutation(args: {
    path: string;
    previousArray: unknown[];
    nextArray: unknown[];
    meta: BitFieldChangeMeta;
    reindex: (currentIdx: number) => number | null;
  }) {
    const { path, previousArray, nextArray, meta, reindex } = args;
    const state = this.store.getState();
    const newValues = setDeepValue(state.values, path, nextArray);

    const isDirty = this.store.updateDirtyForPath(
      path,
      newValues,
      this.store.getConfig().initialValues,
    );

    const reindexedMeta = reindexFieldArrayMeta(state, path, reindex);

    this.store.dispatch(
      patchStateOperation(
        {
          values: newValues,
          errors: reindexedMeta.errors,
          touched: reindexedMeta.touched,
          isValidating: reindexedMeta.isValidating,
          isDirty,
        },
        [path],
      ),
    );

    this.store.emitFieldChange({
      path,
      previousValue: previousArray,
      nextValue: nextArray,
      values: this.store.getState().values,
      state: this.store.getState(),
      meta,
    });

    this.store.internalSaveSnapshot();
    this.revalidate(path);
  }
}
