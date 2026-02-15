import { BitMask } from "../mask/types";
import { bitMasks } from "../mask";
import { BitConfig, BitErrors, BitState, BitFieldConfig } from "./types";
import { deepClone, deepEqual, getDeepValue, setDeepValue } from "./utils";
import { BitDependencyManager } from "./dependency-manager";
import { BitHistoryManager } from "./history-manager";
import { BitArrayManager, BitStoreAdapter } from "./array-manager";

export class BitStore<T extends object = any> implements BitStoreAdapter<T> {
  private state: BitState<T>;
  private listeners: Set<() => void> = new Set();
  private config: BitConfig<T>;
  private validationTimeout?: any;
  private currentValidationId: number = 0;

  public defaultUnmask: boolean;
  public masks: Record<string, BitMask>;

  private deps: BitDependencyManager<T>;
  private history: BitHistoryManager<T>;
  public arrays: BitArrayManager<T>;

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

    const initialValues = deepClone(this.config.initialValues);
    const valuesWithComputeds = this.applyComputeds(initialValues);

    this.state = {
      values: valuesWithComputeds,
      errors: {},
      touched: {},
      isValid: true,
      isSubmitting: false,
      isDirty: false,
    };

    this.deps = new BitDependencyManager<T>();
    this.history = new BitHistoryManager<T>(!!this.config.enableHistory, 15);
    this.arrays = new BitArrayManager<T>(this);

    this.internalSaveSnapshot();
  }

  private applyComputeds(values: T): T {
    if (!this.config.computed) return values;

    let nextValues = values;
    const computedEntries = Object.entries(this.config.computed);

    for (let i = 0; i < 2; i++) {
      let changedInThisPass = false;

      for (const [path, computeFn] of computedEntries) {
        const newValue = computeFn(nextValues);
        const currentValue = getDeepValue(nextValues, path);

        if (!deepEqual(currentValue, newValue)) {
          nextValues = setDeepValue(nextValues, path, newValue);
          changedInThisPass = true;
        }
      }

      if (!changedInThisPass) break;
    }

    return nextValues;
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

  registerConfig(path: string, config: BitFieldConfig<T>) {
    this.deps.register(path, config, this.state.values);
  }

  isHidden(path: string): boolean {
    return this.deps.isHidden(path);
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
    const newErrors = { ...this.state.errors };
    delete newErrors[path as keyof BitErrors<T>];

    const toggledFields = this.deps.updateDependencies(path, newValues);
    let visibilitiesChanged = toggledFields.length > 0;

    toggledFields.forEach((depPath) => {
      if (this.deps.isHidden(depPath)) {
        delete newErrors[depPath as keyof BitErrors<T>];
      }
    });

    const isNowValid = Object.keys(newErrors).length === 0;

    this.internalUpdateState({
      values: newValues,
      errors: newErrors,
      isValid: isNowValid,
      isDirty: !deepEqual(newValues, this.config.initialValues),
    });

    if (!this.config.resolver) {
      if (visibilitiesChanged) this.notify();
      return;
    }

    this.triggerValidation([path]);
  }

  blurField(path: string) {
    this.internalSaveSnapshot();

    if (!this.state.touched[path as keyof typeof this.state.touched]) {
      this.internalUpdateState({
        touched: { ...this.state.touched, [path]: true },
      });
    }

    this.triggerValidation([path]);
  }

  setValues(newValues: T) {
    const clonedValues = deepClone(newValues);
    this.config.initialValues = deepClone(clonedValues);

    if (this.validationTimeout) clearTimeout(this.validationTimeout);

    this.deps.evaluateAll(clonedValues);

    this.internalUpdateState({
      values: clonedValues,
      errors: {},
      touched: {},
      isValid: true,
      isDirty: false,
      isSubmitting: false,
    });
    this.internalSaveSnapshot();
    this.internalValidate();
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
    if (this.validationTimeout) clearTimeout(this.validationTimeout);

    const initialCloned = deepClone(this.config.initialValues);
    this.deps.evaluateAll(initialCloned);

    this.internalUpdateState({
      values: initialCloned,
      errors: {},
      touched: {},
      isValid: true,
      isDirty: false,
      isSubmitting: false,
    });
    this.history.reset(initialCloned);
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
      this.internalValidate();
    }
  }

  redo() {
    const nextState = this.history.redo();
    if (nextState) {
      this.internalUpdateState({ values: nextState });
      this.internalValidate();
    }
  }

  private triggerValidation(scopeFields: string[]) {
    if (this.validationTimeout) clearTimeout(this.validationTimeout);

    const delay = this.config.validationDelay ?? 300;

    if (delay > 0) {
      this.validationTimeout = setTimeout(() => {
        this.internalValidate({ scopeFields });
      }, delay);
    } else {
      this.internalValidate({ scopeFields });
    }
  }

  internalValidate(options?: {
    scope?: string;
    scopeFields?: string[];
  }): Promise<boolean> {
    return this.validate(options);
  }

  async validate(options?: {
    scope?: string;
    scopeFields?: string[];
  }): Promise<boolean> {
    if (!this.config.resolver) return true;

    const validationId = ++this.currentValidationId;

    let targetFields: string[] | undefined = options?.scopeFields;

    if (options?.scope && this.config.scopes?.[options.scope]) {
      targetFields = this.config.scopes[options.scope];
    }

    const allErrors = await this.config.resolver(this.state.values, {
      scopeFields: targetFields,
    });

    this.deps.hiddenFields.forEach((hiddenPath) => {
      delete allErrors[hiddenPath as keyof typeof allErrors];
    });

    if (validationId !== this.currentValidationId) {
      return this.state.isValid;
    }

    if (targetFields) {
      const newErrors = { ...this.state.errors };

      targetFields.forEach((field) => {
        if (allErrors[field]) {
          newErrors[field as keyof BitErrors<T>] = allErrors[field] as any;
        } else {
          delete newErrors[field as keyof BitErrors<T>];
        }
      });

      const isValid = Object.keys(allErrors).length === 0;
      this.internalUpdateState({ errors: newErrors, isValid });

      return targetFields.every((field) => !allErrors[field]);
    }

    const isValid = Object.keys(allErrors).length === 0;
    this.internalUpdateState({ errors: allErrors as BitErrors<T>, isValid });
    return isValid;
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

  async submit(onSuccess: (values: T) => void | Promise<void>) {
    if (this.state.isSubmitting) return;

    if (this.validationTimeout) clearTimeout(this.validationTimeout);

    this.internalUpdateState({ isSubmitting: true });

    const isValid = await this.validate();

    if (isValid) {
      try {
        let valuesToSubmit = deepClone(this.state.values);

        this.deps.hiddenFields.forEach((hiddenPath) => {
          valuesToSubmit = setDeepValue(valuesToSubmit, hiddenPath, undefined);
        });

        if (this.config.transform) {
          for (const path in this.config.transform) {
            const transformer = this.config.transform[path];
            if (transformer) {
              const currentVal = getDeepValue(valuesToSubmit, path);
              valuesToSubmit = setDeepValue(
                valuesToSubmit,
                path,
                transformer(currentVal, this.state.values),
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
        newTouched[path as keyof typeof newTouched] = true;
      });
      this.internalUpdateState({ touched: newTouched });
    }

    this.internalUpdateState({ isSubmitting: false });
  }

  internalUpdateState(partialState: Partial<BitState<T>>) {
    let nextState = { ...this.state, ...partialState };

    if (partialState.values) {
      nextState.values = this.applyComputeds(partialState.values);
    }

    this.state = nextState;
    this.notify();
  }

  internalSaveSnapshot() {
    this.history.saveSnapshot(this.state.values);
  }

  private notify() {
    this.listeners.forEach((listener) => listener());
  }
}
