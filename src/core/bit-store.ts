export type MaskFn = (value: any) => any;
export type UnmaskFn = (value: any) => any;
export type ValidatorFn<T> = (values: T) => Partial<Record<keyof T, string>> | Promise<Partial<Record<keyof T, string>>>;

export interface BitOptions<T> {
  masks?: Partial<Record<keyof T, MaskFn>>;
  unmasks?: Partial<Record<keyof T, UnmaskFn>>;
  validator?: ValidatorFn<T>;
}

export class BitStore<T extends Record<string, any>> {
  private initialValues: T;
  private state: T;
  private touched: Partial<Record<keyof T, boolean>> = {};
  private errors: Partial<Record<keyof T, string>> = {};
  private masks: Partial<Record<keyof T, MaskFn>>;
  private unmasks: Partial<Record<keyof T, UnmaskFn>>;
  private validator?: ValidatorFn<T>;
  public isValidating = false;
  private listeners = new Set<() => void>();

  constructor(initialValues: T, options?: BitOptions<T>) {
    this.initialValues = JSON.parse(JSON.stringify(initialValues));
    this.state = JSON.parse(JSON.stringify(initialValues));
    this.masks = options?.masks || {};
    this.unmasks = options?.unmasks || {};
    this.validator = options?.validator;
    this.applyMasks();
  }

  getState = () => this.state;
  getErrors = () => this.errors;
  getTouched = () => this.touched;
  isDirty = () => JSON.stringify(this.state) !== JSON.stringify(this.initialValues);

  getRawState = () => {
    const raw: any = { ...this.state };
    for (const key in this.unmasks) {
      if (raw[key] !== undefined) raw[key] = this.unmasks[key]!(raw[key]);
    }
    return raw as T;
  };

  setState = async (nextState: Partial<T>) => {
    const masked: any = { ...nextState };
    for (const key in masked) {
      if (this.masks[key as keyof T]) {
        masked[key] = this.masks[key as keyof T]!(masked[key]);
      }
    }
    this.state = { ...this.state, ...masked };
    await this.validate();
    this.notify();
  };

  markTouched = (field: keyof T) => {
    if (this.touched[field]) return;
    this.touched[field] = true;
    this.notify();
  };

  reset = () => {
    this.state = JSON.parse(JSON.stringify(this.initialValues));
    this.touched = {};
    this.errors = {};
    this.applyMasks();
    this.notify();
  };

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private notify = () => this.listeners.forEach(l => l());

  private applyMasks() {
    for (const k in this.masks) {
      if (this.state[k] !== undefined) this.state[k] = this.masks[k]!(this.state[k]);
    }
  }

  private async validate() {
    if (!this.validator) return;
    const res = this.validator(this.state);
    if (res instanceof Promise) {
      this.isValidating = true;
      this.notify();
      this.errors = await res;
      this.isValidating = false;
    } else {
      this.errors = res;
    }
  }
}