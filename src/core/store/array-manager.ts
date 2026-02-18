import { BitStoreAdapter } from "./types";
import {
  getDeepValue,
  setDeepValue,
  deepEqual,
  shiftKeys,
  swapKeys,
  moveKeys,
} from "./utils";

export class BitArrayManager<T extends object = any> {
  constructor(private store: BitStoreAdapter<T>) {}

  pushItem(path: string, value: any) {
    const arr = getDeepValue(this.store.getState().values, path) || [];
    this.store.setField(path, [...arr, value]);
    this.store.internalSaveSnapshot();
  }

  prependItem(path: string, value: any) {
    const arr = getDeepValue(this.store.getState().values, path) || [];
    this.store.setField(path, [value, ...arr]);
    this.store.internalSaveSnapshot();
  }

  insertItem(path: string, index: number, value: any) {
    const arr = [...(getDeepValue(this.store.getState().values, path) || [])];
    arr.splice(index, 0, value);
    this.store.setField(path, arr);
    this.store.internalSaveSnapshot();
  }

  removeItem(path: string, index: number) {
    const state = this.store.getState();
    const arr = getDeepValue(state.values, path);
    if (!Array.isArray(arr)) return;

    if (this.store.unregisterPrefix) {
      this.store.unregisterPrefix(`${path}.${index}.`);
    }

    const newArray = arr.filter((_, i) => i !== index);
    const newValues = setDeepValue(state.values, path, newArray);

    this.store.internalUpdateState({
      values: newValues,
      errors: shiftKeys(state.errors, path, index),
      touched: shiftKeys(state.touched, path, index),
      isDirty: !deepEqual(newValues, this.store.getConfig().initialValues),
    });

    this.store.internalSaveSnapshot();
    this.revalidate(path);
  }

  swapItems(path: string, indexA: number, indexB: number) {
    const state = this.store.getState();
    const arr = [...(getDeepValue(state.values, path) || [])];
    [arr[indexA], arr[indexB]] = [arr[indexB], arr[indexA]];

    const newValues = setDeepValue(state.values, path, arr);

    this.store.internalUpdateState({
      values: newValues,
      errors: swapKeys(state.errors, path, indexA, indexB),
      touched: swapKeys(state.touched, path, indexA, indexB),
    });

    this.store.internalSaveSnapshot();
    this.revalidate(path);
  }

  moveItem(path: string, from: number, to: number) {
    const state = this.store.getState();
    const arr = [...(getDeepValue(state.values, path) || [])];
    const [item] = arr.splice(from, 1);
    arr.splice(to, 0, item);

    const newValues = setDeepValue(state.values, path, arr);

    this.store.internalUpdateState({
      values: newValues,
      errors: moveKeys(state.errors, path, from, to),
      touched: moveKeys(state.touched, path, from, to),
    });

    this.store.internalSaveSnapshot();
    this.revalidate(path);
  }

  private revalidate(path: string) {
    const storeInternals = this.store as any;

    if (typeof storeInternals.triggerValidation === "function") {
      storeInternals.triggerValidation([path]);
    } else if (typeof this.store.validate === "function") {
      this.store.validate();
    }
  }
}
