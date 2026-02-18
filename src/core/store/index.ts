import { BitMask } from "../mask/types";
import { bitMasks } from "../mask";
import { BitConfig, BitErrors, BitState, BitFieldConfig } from "./types";
import { deepClone, deepEqual, getDeepValue } from "./utils";
import { BitDependencyManager } from "./dependency-manager";
import { BitHistoryManager } from "./history-manager";
import { BitArrayManager, BitStoreAdapter } from "./array-manager";
import { BitComputedManager } from "./computed-manager";
import {
  BitValidationManager,
  BitValidationAdapter,
} from "./validation-manager";
import { BitLifecycleManager, BitLifecycleAdapter } from "./lifecycle-manager";

declare global {
  var __BIT_FORM__:
    | {
        stores: Record<string, any>;
        listeners: Set<Function>;
        dispatch: (storeId: string, state: any) => void;
        subscribe: (
          listener: (storeId: string, state: any) => void,
        ) => () => void;
      }
    | undefined;
}

const rootGlobal = typeof globalThis !== "undefined" ? globalThis : global;
if (!rootGlobal.__BIT_FORM__) {
  rootGlobal.__BIT_FORM__ = {
    stores: {},
    listeners: new Set(),
    dispatch(id, state) {
      this.listeners.forEach((fn) => fn(id, state));
    },
    subscribe(fn) {
      this.listeners.add(fn);
      return () => this.listeners.delete(fn);
    },
  };
}

export class BitStore<T extends object = any>
  implements BitStoreAdapter<T>, BitValidationAdapter<T>, BitLifecycleAdapter<T>
{
  private state: BitState<T>;
  private listeners: Set<() => void> = new Set();

  public config: BitConfig<T>;
  public deps: BitDependencyManager<T>;
  public history: BitHistoryManager<T>;
  public validator: BitValidationManager<T>;
  public computeds: BitComputedManager<T>;
  public lifecycle: BitLifecycleManager<T>;
  public arrays: BitArrayManager<T>;
  public masks: Record<string, BitMask>;
  public defaultUnmask: boolean;
  public storeId: string;

  constructor(config: BitConfig<T> = {}) {
    const rawInitial = config.initialValues || ({} as T);

    this.config = {
      validationDelay: 300,
      enableHistory: false,
      ...config,
      initialValues: deepClone(rawInitial),
    };

    this.defaultUnmask = config.defaultUnmask ?? true;
    this.masks = config.masks ?? bitMasks;

    this.deps = new BitDependencyManager<T>();
    this.history = new BitHistoryManager<T>(!!this.config.enableHistory, 15);
    this.computeds = new BitComputedManager<T>(this.config);
    this.validator = new BitValidationManager<T>(this);
    this.arrays = new BitArrayManager<T>(this);
    this.lifecycle = new BitLifecycleManager<T>(this);

    const initialValues = deepClone(this.config.initialValues);
    const valuesWithComputeds = this.computeds.apply(initialValues);

    this.state = {
      values: valuesWithComputeds,
      errors: {},
      touched: {},
      isValidating: {},
      isValid: true,
      isSubmitting: false,
      isDirty: false,
    };

    if (this.config.fields) {
      Object.entries(this.config.fields).forEach(([path, fieldConfig]) => {
        this.deps.register(
          path,
          fieldConfig as BitFieldConfig<T>,
          initialValues,
        );
      });
    }

    this.internalSaveSnapshot();

    this.storeId =
      config.name || `bit-form-${Math.random().toString(36).substring(2, 9)}`;
    if (rootGlobal.__BIT_FORM__) {
      rootGlobal.__BIT_FORM__.stores[this.storeId] = this;
    }
  }

  getConfig() {
    return this.config;
  }

  getState(): BitState<T> {
    return this.state;
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

  unregisterField(path: string) {
    this.deps.unregister(path);
    const newErrors = { ...this.state.errors };
    if (newErrors[path as keyof BitErrors<T>]) {
      delete newErrors[path as keyof BitErrors<T>];
      this.internalUpdateState({
        errors: newErrors,
        isValid: Object.keys(newErrors).length === 0,
      });
    }
  }

  unregisterPrefix(prefix: string) {
    this.deps.unregisterPrefix(prefix);
  }

  registerConfig(path: string, config: BitFieldConfig<T>) {
    this.deps.register(path, config, this.state.values);
    if (this.deps.isHidden(path)) {
      this.notify();
    }
  }

  isHidden(path: string): boolean {
    return this.deps.isHidden(path);
  }

  isRequired(path: string): boolean {
    return this.deps.isRequired(path, this.state.values);
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
    const { visibilitiesChanged } = this.lifecycle.updateField(path, value);

    if (!this.config.resolver || visibilitiesChanged) {
      this.notify();
    }
  }

  blurField(path: string) {
    this.internalSaveSnapshot();

    if (!this.state.touched[path as keyof typeof this.state.touched]) {
      this.internalUpdateState({
        touched: { ...this.state.touched, [path]: true },
      });
    }

    this.validator.trigger([path]);
  }

  setValues(newValues: T) {
    this.lifecycle.updateAll(newValues);
  }

  setError(path: string, message: string | undefined) {
    this.internalUpdateState({
      errors: { ...this.state.errors, [path]: message },
      isValid: false,
    });
  }

  setErrors(errors: BitErrors<T>) {
    this.internalUpdateState({
      errors: { ...this.state.errors, ...errors },
      isValid: Object.keys(errors).length === 0,
    });
  }

  setServerErrors(serverErrors: Record<string, string[] | string>) {
    const formattedErrors: BitErrors<T> = {};

    for (const [key, value] of Object.entries(serverErrors)) {
      formattedErrors[key as keyof BitErrors<T>] = Array.isArray(value)
        ? value[0]
        : (value as any);
    }

    this.internalUpdateState({
      errors: { ...this.state.errors, ...formattedErrors },
      isValid: false,
    });
  }

  reset() {
    this.lifecycle.reset();
  }

  registerMask(name: string, mask: BitMask) {
    this.masks[name] = mask;
  }

  pushItem(path: string, value: any) {
    this.arrays.pushItem(path, value);
  }
  prependItem(path: string, value: any) {
    this.arrays.prependItem(path, value);
  }
  insertItem(path: string, index: number, value: any) {
    this.arrays.insertItem(path, index, value);
  }
  removeItem(path: string, index: number) {
    this.arrays.removeItem(path, index);
  }
  swapItems(path: string, indexA: number, indexB: number) {
    this.arrays.swapItems(path, indexA, indexB);
  }
  moveItem(path: string, from: number, to: number) {
    this.arrays.moveItem(path, from, to);
  }

  get canUndo(): boolean {
    return this.history.canUndo;
  }
  get canRedo(): boolean {
    return this.history.canRedo;
  }

  undo() {
    const prevState = this.history.undo();
    if (prevState) {
      this.internalUpdateState({ values: prevState });
      this.validator.validate();
    }
  }

  redo() {
    const nextState = this.history.redo();
    if (nextState) {
      this.internalUpdateState({ values: nextState });
      this.validator.validate();
    }
  }

  validate(options?: {
    scope?: string;
    scopeFields?: string[];
  }): Promise<boolean> {
    return this.validator.validate(options);
  }

  getStepStatus(scopeName: string) {
    const fields = this.config.scopes?.[scopeName] || [];
    const hasErrors = fields.some(
      (f) => !!this.state.errors[f as keyof BitErrors<T>],
    );
    const isDirty = fields.some((f) => {
      const current = getDeepValue(this.state.values, f);
      const initial = getDeepValue(this.config.initialValues, f);
      return !deepEqual(current, initial);
    });

    return { hasErrors, isDirty };
  }

  isFieldDirty(path: string): boolean {
    const currentValue = getDeepValue(this.state.values, path);
    const initialValue = getDeepValue(this.config.initialValues, path);

    return !deepEqual(currentValue, initialValue);
  }

  isFieldValidating(path: string): boolean {
    return !!this.getState().isValidating[path];
  }

  async submit(onSuccess: (values: T) => void | Promise<void>) {
    return this.lifecycle.submit(onSuccess);
  }

  internalUpdateState(partialState: Partial<BitState<T>>) {
    let nextState = { ...this.state, ...partialState };

    if (partialState.values) {
      nextState.values = this.computeds.apply(partialState.values);
    }

    this.state = nextState;
    this.notify();

    if (rootGlobal.__BIT_FORM__) {
      rootGlobal.__BIT_FORM__?.dispatch(this.storeId, this.state);
    }
  }

  internalSaveSnapshot() {
    this.history.saveSnapshot(this.state.values);
  }

  cleanup() {
    this.listeners.clear();
    this.validator.cancelAll();

    if (rootGlobal.__BIT_FORM__) {
      delete rootGlobal.__BIT_FORM__.stores[this.storeId];
    }
  }

  private notify() {
    this.listeners.forEach((listener) => listener());
  }
}
