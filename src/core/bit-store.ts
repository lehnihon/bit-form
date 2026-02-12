export type BitErrors<T> = { [key: string]: string | undefined };
export type BitTouched<T> = { [key: string]: boolean | undefined };

export interface BitState<T> {
  values: T;
  errors: BitErrors<T>;
  touched: BitTouched<T>;
  isValid: boolean;
  isSubmitting: boolean;
  isDirty: boolean;
}

export type ValidatorFn<T> = (
  values: T,
) => Promise<BitErrors<T>> | BitErrors<T>;

export interface BitConfig<T> {
  initialValues: T;
  resolver?: ValidatorFn<T>;
  transform?: Partial<Record<string, (value: any) => any>>;
  validationDelay?: number;
}

export class BitStore<T extends object = any> {
  private state: BitState<T>;
  private listeners: Set<() => void> = new Set();
  private config: BitConfig<T>;
  private validationTimeout?: any;

  constructor(config: BitConfig<T>) {
    this.config = {
      validationDelay: 300,
      ...config,
      initialValues: this.deepClone(config.initialValues),
    };
    this.state = {
      values: this.deepClone(this.config.initialValues),
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
    let lastValue = this.deepClone(this.getDeepValue(this.state.values, path));
    return this.subscribe(() => {
      const newValue = this.getDeepValue(this.state.values, path);
      if (!this.deepEqual(newValue, lastValue)) {
        lastValue = this.deepClone(newValue);
        callback(newValue);
      }
    });
  }

  setField(path: string, value: any) {
    const newValues = this.setDeepValue(this.state.values, path, value);
    this.updateState({
      values: newValues,
      isDirty: !this.deepEqual(newValues, this.config.initialValues),
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
    const clonedValues = this.deepClone(newValues);
    this.config.initialValues = this.deepClone(clonedValues);

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
      values: this.deepClone(this.config.initialValues),
      errors: {},
      touched: {},
      isValid: true,
      isDirty: false,
      isSubmitting: false,
    });
  }

  pushItem(path: string, value: any) {
    const currentArray = this.getDeepValue(this.state.values, path) || [];
    if (!Array.isArray(currentArray)) return;
    this.setField(path, [...currentArray, value]);
  }

  prependItem(path: string, value: any) {
    const currentArray = this.getDeepValue(this.state.values, path) || [];
    if (!Array.isArray(currentArray)) return;
    this.setField(path, [value, ...currentArray]);
  }

  insertItem(path: string, index: number, value: any) {
    const currentArray = [
      ...(this.getDeepValue(this.state.values, path) || []),
    ];
    if (!Array.isArray(currentArray)) return;
    currentArray.splice(index, 0, value);
    this.setField(path, currentArray);
  }

  removeItem(path: string, index: number) {
    const currentArray = this.getDeepValue(this.state.values, path);
    if (!Array.isArray(currentArray)) return;

    const newArray = currentArray.filter((_, i) => i !== index);
    const newValues = this.setDeepValue(this.state.values, path, newArray);

    const prefix = `${path}.${index}`;
    this.updateState({
      values: newValues,
      errors: this.cleanPrefixedKeys(this.state.errors, prefix),
      touched: this.cleanPrefixedKeys(this.state.touched, prefix),
      isDirty: !this.deepEqual(newValues, this.config.initialValues),
    });

    if (this.validationTimeout) clearTimeout(this.validationTimeout);
    this.validate();
  }

  swapItems(path: string, indexA: number, indexB: number) {
    const currentArray = [
      ...(this.getDeepValue(this.state.values, path) || []),
    ];
    if (!Array.isArray(currentArray)) return;

    [currentArray[indexA], currentArray[indexB]] = [
      currentArray[indexB],
      currentArray[indexA],
    ];
    this.setField(path, currentArray);
  }

  moveItem(path: string, from: number, to: number) {
    const currentArray = [
      ...(this.getDeepValue(this.state.values, path) || []),
    ];
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
        let valuesToSubmit = this.deepClone(this.state.values);

        if (this.config.transform) {
          for (const path in this.config.transform) {
            const transformer = this.config.transform[path];
            if (transformer) {
              const currentVal = this.getDeepValue(valuesToSubmit, path);
              valuesToSubmit = this.setDeepValue(
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

  private getDeepValue(obj: any, path: string): any {
    return path.split(".").reduce((prev, curr) => prev?.[curr], obj);
  }

  private setDeepValue(obj: any, path: string, value: any): any {
    const keys = path.split(".");
    const lastKey = keys.pop()!;
    const newObj = Array.isArray(obj) ? [...obj] : { ...obj };

    let current = newObj;
    for (const key of keys) {
      if (!current[key]) current[key] = {};
      current[key] = Array.isArray(current[key])
        ? [...current[key]]
        : { ...current[key] };
      current = current[key];
    }

    current[lastKey] = value;
    return newObj;
  }

  private cleanPrefixedKeys(
    obj: Record<string, any>,
    prefix: string,
  ): Record<string, any> {
    const newObj: Record<string, any> = {};
    const prefixWithDot = `${prefix}.`;

    for (const key in obj) {
      if (key !== prefix && !key.startsWith(prefixWithDot)) {
        newObj[key] = obj[key];
      }
    }
    return newObj;
  }

  private deepClone(obj: any): any {
    if (obj === null || typeof obj !== "object") return obj;
    if (Array.isArray(obj)) return obj.map((item) => this.deepClone(item));
    const clone: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        clone[key] = this.deepClone(obj[key]);
      }
    }
    return clone;
  }

  private deepEqual(a: any, b: any): boolean {
    if (a === b) return true;
    if (
      a === null ||
      typeof a !== "object" ||
      b === null ||
      typeof b !== "object"
    )
      return false;

    const keysA = Object.keys(a);
    const keysB = Object.keys(b);

    if (keysA.length !== keysB.length) return false;

    for (const key of keysA) {
      if (!keysB.includes(key) || !this.deepEqual(a[key], b[key])) return false;
    }

    return true;
  }
}
