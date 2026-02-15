import {
  getDeepValue,
  setDeepValue,
  cleanPrefixedKeys,
  deepEqual,
} from "./utils";

export interface BitStoreAdapter<T extends object = any> {
  getState(): any;
  getConfig(): any;
  setField(path: string, value: any): void;
  internalUpdateState(partialState: any): void;
  internalSaveSnapshot(): void;
  internalValidate(): void;
}

export class BitArrayManager<T extends object = any> {
  constructor(private store: BitStoreAdapter<T>) {}

  pushItem(path: string, value: any) {
    const currentArray = getDeepValue(this.store.getState().values, path) || [];
    if (!Array.isArray(currentArray)) return;
    this.store.setField(path, [...currentArray, value]);
    this.store.internalSaveSnapshot();
  }

  prependItem(path: string, value: any) {
    const currentArray = getDeepValue(this.store.getState().values, path) || [];
    if (!Array.isArray(currentArray)) return;
    this.store.setField(path, [value, ...currentArray]);
    this.store.internalSaveSnapshot();
  }

  insertItem(path: string, index: number, value: any) {
    const currentArray = [
      ...(getDeepValue(this.store.getState().values, path) || []),
    ];
    if (!Array.isArray(currentArray)) return;
    currentArray.splice(index, 0, value);
    this.store.setField(path, currentArray);
    this.store.internalSaveSnapshot();
  }

  removeItem(path: string, index: number) {
    const state = this.store.getState();
    const currentArray = getDeepValue(state.values, path);
    if (!Array.isArray(currentArray)) return;

    const newArray = currentArray.filter((_: any, i: number) => i !== index);
    const newValues = setDeepValue(state.values, path, newArray);

    const prefix = `${path}.${index}`;
    this.store.internalUpdateState({
      values: newValues,
      errors: cleanPrefixedKeys(state.errors, prefix),
      touched: cleanPrefixedKeys(state.touched, prefix),
      isDirty: !deepEqual(newValues, this.store.getConfig().initialValues),
    });

    this.store.internalSaveSnapshot();
    this.store.internalValidate();
  }

  swapItems(path: string, indexA: number, indexB: number) {
    const currentArray = [
      ...(getDeepValue(this.store.getState().values, path) || []),
    ];
    if (!Array.isArray(currentArray)) return;

    [currentArray[indexA], currentArray[indexB]] = [
      currentArray[indexB],
      currentArray[indexA],
    ];
    this.store.setField(path, currentArray);
    this.store.internalSaveSnapshot();
  }

  moveItem(path: string, from: number, to: number) {
    const currentArray = [
      ...(getDeepValue(this.store.getState().values, path) || []),
    ];
    if (!Array.isArray(currentArray)) return;

    const [item] = currentArray.splice(from, 1);
    currentArray.splice(to, 0, item);
    this.store.setField(path, currentArray);
    this.store.internalSaveSnapshot();
  }
}
