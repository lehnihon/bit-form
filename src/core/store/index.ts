import { BitMask } from "../mask/types";
import { bitMasks } from "../mask";
import { BitConfig, BitErrors, BitState } from "./types";
import {
  deepClone,
  deepEqual,
  getDeepValue,
  setDeepValue,
  cleanPrefixedKeys,
} from "./utils";

export class BitStore<T extends object = any> {
  private state: BitState<T>;
  private listeners: Set<() => void> = new Set();
  private config: BitConfig<T>;
  private validationTimeout?: any;

  public defaultUnmask: boolean;
  public masks: Record<string, BitMask>;

  constructor(config: BitConfig<T>) {
    this.config = {
      validationDelay: 300,
      ...config,
      initialValues: deepClone(config.initialValues),
    };

    this.defaultUnmask = config.defaultUnmask ?? true;
    this.masks = config.masks ?? bitMasks;

    this.state = {
      values: deepClone(this.config.initialValues),
      errors: {},
      touched: {},
      isValid: true,
      isSubmitting: false,
      isDirty: false,
    };
  }

  get isValid(): boolean {
    return this.state.isValid;
  }

  get isSubmitting(): boolean {
    return this.state.isSubmitting;
  }

  get isDirty(): boolean {
    return this.state.isDirty;
  }

  getState(): BitState<T> {
    return this.state;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  watch(path: string, callback: (value: any) => void) {
    let lastValue = deepClone(getDeepValue(this.state.values, path));
    return this.subscribe(() => {
      const newValue = getDeepValue(this.state.values, path);
      if (!deepEqual(newValue, lastValue)) {
        lastValue = deepClone(newValue);
        callback(newValue);
      }
    });
  }

  setField(path: string, value: any) {
    const newValues = setDeepValue(this.state.values, path, value);
    this.updateState({
      values: newValues,
      isDirty: !deepEqual(newValues, this.config.initialValues),
    });

    if (!this.config.resolver) {
      this.notify();
      return;
    }

    if (this.validationTimeout) clearTimeout(this.validationTimeout);

    const delay = this.config.validationDelay ?? 300;

    if (delay > 0) {
      this.validationTimeout = setTimeout(() => {
        this.validate();
      }, delay);
    } else {
      this.validate();
    }
  }

  blurField(path: string) {
    if (this.state.touched[path]) return;

    this.updateState({
      touched: { ...this.state.touched, [path]: true },
    });
    this.validate();
  }

  setValues(newValues: T) {
    const clonedValues = deepClone(newValues);
    this.config.initialValues = deepClone(clonedValues);

    if (this.validationTimeout) clearTimeout(this.validationTimeout);

    this.updateState({
      values: clonedValues,
      errors: {},
      touched: {},
      isValid: true,
      isDirty: false,
      isSubmitting: false,
    });
    this.validate();
  }

  setError(path: string, message: string | undefined) {
    this.updateState({
      errors: { ...this.state.errors, [path]: message },
      isValid: false,
    });
  }

  setErrors(errors: BitErrors<T>) {
    this.updateState({
      errors: { ...this.state.errors, ...errors },
      isValid: Object.keys(errors).length === 0,
    });
  }

  reset() {
    if (this.validationTimeout) clearTimeout(this.validationTimeout);

    this.updateState({
      values: deepClone(this.config.initialValues),
      errors: {},
      touched: {},
      isValid: true,
      isDirty: false,
      isSubmitting: false,
    });
  }

  registerMask(name: string, mask: BitMask) {
    this.masks[name] = mask;
  }

  pushItem(path: string, value: any) {
    const currentArray = getDeepValue(this.state.values, path) || [];
    if (!Array.isArray(currentArray)) return;
    this.setField(path, [...currentArray, value]);
  }

  prependItem(path: string, value: any) {
    const currentArray = getDeepValue(this.state.values, path) || [];
    if (!Array.isArray(currentArray)) return;
    this.setField(path, [value, ...currentArray]);
  }

  insertItem(path: string, index: number, value: any) {
    const currentArray = [...(getDeepValue(this.state.values, path) || [])];
    if (!Array.isArray(currentArray)) return;
    currentArray.splice(index, 0, value);
    this.setField(path, currentArray);
  }

  removeItem(path: string, index: number) {
    const currentArray = getDeepValue(this.state.values, path);
    if (!Array.isArray(currentArray)) return;

    const newArray = currentArray.filter((_: any, i: number) => i !== index);
    const newValues = setDeepValue(this.state.values, path, newArray);

    const prefix = `${path}.${index}`;
    this.updateState({
      values: newValues,
      errors: cleanPrefixedKeys(this.state.errors, prefix),
      touched: cleanPrefixedKeys(this.state.touched, prefix),
      isDirty: !deepEqual(newValues, this.config.initialValues),
    });

    if (this.validationTimeout) clearTimeout(this.validationTimeout);
    this.validate();
  }

  swapItems(path: string, indexA: number, indexB: number) {
    const currentArray = [...(getDeepValue(this.state.values, path) || [])];
    if (!Array.isArray(currentArray)) return;

    [currentArray[indexA], currentArray[indexB]] = [
      currentArray[indexB],
      currentArray[indexA],
    ];
    this.setField(path, currentArray);
  }

  moveItem(path: string, from: number, to: number) {
    const currentArray = [...(getDeepValue(this.state.values, path) || [])];
    if (!Array.isArray(currentArray)) return;

    const [item] = currentArray.splice(from, 1);
    currentArray.splice(to, 0, item);
    this.setField(path, currentArray);
  }

  async validate(): Promise<boolean> {
    if (!this.config.resolver) return true;

    const errors = await this.config.resolver(this.state.values);
    const isValid = Object.keys(errors).length === 0;

    this.updateState({ errors, isValid });
    return isValid;
  }

  async submit(onSuccess: (values: T) => void | Promise<void>) {
    if (this.state.isSubmitting) return;

    if (this.validationTimeout) clearTimeout(this.validationTimeout);

    this.updateState({ isSubmitting: true });

    const isValid = await this.validate();

    if (isValid) {
      try {
        let valuesToSubmit = deepClone(this.state.values);

        if (this.config.transform) {
          for (const path in this.config.transform) {
            const transformer = this.config.transform[path];
            if (transformer) {
              const currentVal = getDeepValue(valuesToSubmit, path);
              valuesToSubmit = setDeepValue(
                valuesToSubmit,
                path,
                transformer(currentVal),
              );
            }
          }
        }
        await onSuccess(valuesToSubmit);
      } catch (error) {
        console.error(error);
      }
    } else {
      const newTouched = { ...this.state.touched };
      Object.keys(this.state.errors).forEach((path) => {
        newTouched[path] = true;
      });
      this.updateState({ touched: newTouched });
    }

    this.updateState({ isSubmitting: false });
  }

  private updateState(partialState: Partial<BitState<T>>) {
    this.state = { ...this.state, ...partialState };
    this.notify();
  }

  private notify() {
    this.listeners.forEach((listener) => listener());
  }
}
