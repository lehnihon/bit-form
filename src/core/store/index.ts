import { bitBus } from "./bus";
import { BitMask } from "../mask/types";
import { bitMasks } from "../mask";
import {
  BitConfig,
  BitErrors,
  BitState,
  BitFieldConfig,
  BitResolvedConfig,
  BitStoreAdapter,
  BitValidationAdapter,
  BitLifecycleAdapter,
  BitPath,
  BitPathValue,
  BitArrayPath,
  BitArrayItem,
} from "./types";
import {
  collectDirtyPaths,
  deepClone,
  deepEqual,
  getDeepValue,
  valueEqual,
} from "../utils";
import { BitDependencyManager } from "./dependency-manager";
import { BitHistoryManager } from "./history-manager";
import { BitArrayManager } from "./array-manager";
import { BitComputedManager } from "./computed-manager";
import { BitValidationManager } from "./validation-manager";
import { BitLifecycleManager } from "./lifecycle-manager";
import { BitDevtoolsManager } from "./devtools-manager";

export class BitStore<T extends object = any>
  implements BitStoreAdapter<T>, BitValidationAdapter<T>, BitLifecycleAdapter<T>
{
  private state: BitState<T>;
  private listeners: Set<() => void> = new Set();

  public config: BitResolvedConfig<T>;
  public deps: BitDependencyManager<T>;
  public history: BitHistoryManager<T>;
  public validator: BitValidationManager<T>;
  public computeds: BitComputedManager<T>;
  public lifecycle: BitLifecycleManager<T>;
  public arrays: BitArrayManager<T>;
  public devtools: BitDevtoolsManager<T>;
  public masks: Record<string, BitMask>;
  public storeId: string;

  private dirtyPaths: Set<string> = new Set();

  constructor(config: BitConfig<T> = {}) {
    const rawInitial = config.initialValues || ({} as T);

    this.config = {
      validationDelay: 300,
      enableHistory: false,
      historyLimit: 15,
      ...config,
      initialValues: deepClone(rawInitial),
    };

    this.masks = config.masks ?? bitMasks;
    this.deps = new BitDependencyManager<T>();
    this.history = new BitHistoryManager<T>(
      !!this.config.enableHistory,
      this.config.historyLimit ?? 15,
    );
    this.computeds = new BitComputedManager<T>(this.config);
    this.validator = new BitValidationManager<T>(this);
    this.arrays = new BitArrayManager<T>(this);
    this.lifecycle = new BitLifecycleManager<T>(this);
    this.devtools = new BitDevtoolsManager<T>(this);

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
    bitBus.stores[this.storeId] = this;
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

  unregisterField<P extends BitPath<T>>(path: P) {
    this.deps.unregister(path);

    const newErrors = { ...this.state.errors };
    const newTouched = { ...this.state.touched };
    let stateChanged = false;

    if (newErrors[path as keyof BitErrors<T>]) {
      delete newErrors[path as keyof BitErrors<T>];
      stateChanged = true;
    }

    if (newTouched[path as keyof typeof newTouched]) {
      delete newTouched[path as keyof typeof newTouched];
      stateChanged = true;
    }

    if (stateChanged) {
      this.internalUpdateState({
        errors: newErrors,
        touched: newTouched,
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

  isHidden<P extends BitPath<T>>(path: P): boolean {
    return this.deps.isHidden(path);
  }

  isRequired<P extends BitPath<T>>(path: P): boolean {
    return this.deps.isRequired(path, this.state.values);
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  watch<P extends BitPath<T>>(
    path: P,
    callback: (value: BitPathValue<T, P>) => void,
  ) {
    let lastValue = deepClone(getDeepValue(this.state.values, path));
    return this.subscribe(() => {
      const newValue = getDeepValue(this.state.values, path);
      if (!deepEqual(newValue, lastValue)) {
        lastValue = deepClone(newValue);
        callback(newValue);
      }
    });
  }

  setField<P extends BitPath<T>>(path: P, value: BitPathValue<T, P>) {
    const { visibilitiesChanged } = this.lifecycle.updateField(path, value);

    if (!this.config.resolver || visibilitiesChanged) {
      this.notify();
    }
  }

  blurField<P extends BitPath<T>>(path: P) {
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
    const newErrors = { ...this.state.errors, [path]: message };
    if (!message) delete (newErrors as any)[path];

    this.internalUpdateState({ errors: newErrors });
  }

  setErrors(errors: BitErrors<T>) {
    this.internalUpdateState({
      errors: { ...this.state.errors, ...errors },
    });
  }

  setServerErrors(serverErrors: Record<string, string[] | string>) {
    const formattedErrors: BitErrors<T> = {};

    for (const [key, value] of Object.entries(serverErrors)) {
      formattedErrors[key as keyof BitErrors<T>] = Array.isArray(value)
        ? value[0]
        : (value as any);
    }

    this.setErrors(formattedErrors);
  }

  reset() {
    this.lifecycle.reset();
  }

  registerMask(name: string, mask: BitMask) {
    this.masks[name] = mask;
  }

  pushItem<P extends BitArrayPath<T>>(
    path: P,
    value: BitArrayItem<BitPathValue<T, P>>,
  ) {
    this.arrays.pushItem(path, value);
  }
  prependItem<P extends BitArrayPath<T>>(
    path: P,
    value: BitArrayItem<BitPathValue<T, P>>,
  ) {
    this.arrays.prependItem(path, value);
  }
  insertItem<P extends BitArrayPath<T>>(
    path: P,
    index: number,
    value: BitArrayItem<BitPathValue<T, P>>,
  ) {
    this.arrays.insertItem(path, index, value);
  }
  removeItem<P extends BitArrayPath<T>>(path: P, index: number) {
    this.arrays.removeItem(path, index);
  }
  swapItems<P extends BitArrayPath<T>>(
    path: P,
    indexA: number,
    indexB: number,
  ) {
    this.arrays.swapItems(path, indexA, indexB);
  }
  moveItem<P extends BitArrayPath<T>>(path: P, from: number, to: number) {
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
      const isDirty = this.rebuildDirtyPaths(
        prevState,
        this.config.initialValues,
      );
      this.internalUpdateState({ values: prevState, isDirty });
      this.validator.validate();
    }
  }

  redo() {
    const nextState = this.history.redo();
    if (nextState) {
      const isDirty = this.rebuildDirtyPaths(
        nextState,
        this.config.initialValues,
      );
      this.internalUpdateState({ values: nextState, isDirty });
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
      return !valueEqual(current, initial);
    });
    const errors = this.getStepErrors(scopeName);

    return { hasErrors, isDirty, errors };
  }

  getStepErrors(scopeName: string): Record<string, string> {
    const fields = this.config.scopes?.[scopeName] || [];
    const result: Record<string, string> = {};

    for (const field of fields) {
      const error = this.state.errors[field as keyof BitErrors<T>];
      if (error) {
        result[field] = error;
      }
    }

    return result;
  }

  isFieldDirty(path: string): boolean {
    const currentValue = getDeepValue(this.state.values, path);
    const initialValue = getDeepValue(this.config.initialValues, path);

    return !valueEqual(currentValue, initialValue);
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

    if (partialState.errors) {
      nextState.isValid = Object.keys(nextState.errors).length === 0;
    }

    this.state = nextState;
    this.notify();

    bitBus.dispatch(this.storeId, this.state);
  }

  internalSaveSnapshot() {
    this.history.saveSnapshot(this.state.values);
  }

  /** Updates dirtyPaths for a single path change. Returns new isDirty. */
  updateDirtyForPath(path: string, values: T, initialValues: T): boolean {
    for (const p of this.dirtyPaths) {
      if (p.startsWith(path + ".")) this.dirtyPaths.delete(p);
    }
    const current = getDeepValue(values, path);
    const initial = getDeepValue(initialValues, path);
    if (valueEqual(current, initial)) {
      this.dirtyPaths.delete(path);
    } else {
      this.dirtyPaths.add(path);
    }
    return this.dirtyPaths.size > 0;
  }

  clearDirtyPaths(): void {
    this.dirtyPaths.clear();
  }

  /** Rebuilds dirtyPaths from full values (used for undo/redo/updateAll). */
  rebuildDirtyPaths(values: T, initialValues: T): boolean {
    this.dirtyPaths = collectDirtyPaths(values, initialValues);
    return this.dirtyPaths.size > 0;
  }

  cleanup() {
    this.listeners.clear();
    this.validator.cancelAll();

    delete bitBus.stores[this.storeId];
  }

  private notify() {
    this.listeners.forEach((listener) => listener());
  }
}
