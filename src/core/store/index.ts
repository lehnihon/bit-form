import { bitBus } from "./bus";
import { BitMask } from "../mask/types";
import {
  BitConfig,
  BitErrors,
  BitState,
  BitFieldDefinition,
  BitResolvedConfig,
  BitStoreAdapter,
  BitValidationAdapter,
  BitLifecycleAdapter,
  BitPath,
  BitPathValue,
  BitArrayPath,
  BitArrayItem,
} from "./types";
import { deepClone, deepEqual, getDeepValue, valueEqual } from "../utils";
import { normalizeConfig } from "./config";
import { BitDependencyManager } from "./dependency-manager";
import { BitHistoryManager } from "./history-manager";
import { BitArrayManager } from "./array-manager";
import { BitComputedManager } from "./computed-manager";
import { BitValidationManager } from "./validation-manager";
import { BitLifecycleManager } from "./lifecycle-manager";
import { BitDevtoolsManager } from "./devtools-manager";
import { BitDirtyManager } from "./dirty-manager";

export class BitStore<T extends object = any>
  implements BitStoreAdapter<T>, BitValidationAdapter<T>, BitLifecycleAdapter<T>
{
  private state: BitState<T>;
  private listeners: Set<() => void> = new Set();

  public config: BitResolvedConfig<T>;
  public depsMg: BitDependencyManager<T>;
  public historyMg: BitHistoryManager<T>;
  public validatorMg: BitValidationManager<T>;
  public computedMg: BitComputedManager<T>;
  public lifecycleMg: BitLifecycleManager<T>;
  public arraysMg: BitArrayManager<T>;
  public devtoolsMg: BitDevtoolsManager<T>;
  public dirtyMg: BitDirtyManager<T>;
  public storeId: string;

  constructor(config: BitConfig<T> = {}) {
    this.config = normalizeConfig(config);

    this.depsMg = new BitDependencyManager<T>();
    this.historyMg = new BitHistoryManager<T>(
      !!this.config.enableHistory,
      this.config.historyLimit ?? 15,
    );
    this.computedMg = new BitComputedManager<T>(this.config);
    this.validatorMg = new BitValidationManager<T>(this);
    this.arraysMg = new BitArrayManager<T>(this);
    this.lifecycleMg = new BitLifecycleManager<T>(this);
    this.devtoolsMg = new BitDevtoolsManager<T>(this);
    this.dirtyMg = new BitDirtyManager<T>();

    const initialValues = deepClone(this.config.initialValues);
    const valuesWithComputeds = this.computedMg.apply(initialValues);

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
        this.depsMg.register(
          path,
          fieldConfig as BitFieldDefinition<T>,
          initialValues,
        );
      });
    }

    this.internalSaveSnapshot();

    this.storeId =
      this.config.name ||
      `bit-form-${Math.random().toString(36).substring(2, 9)}`;
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
    // Campos do config inicial nunca são desregistrados
    if (this.config.fields?.[path as string]) {
      return;
    }
    this.depsMg.unregister(path);

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
    this.depsMg.unregisterPrefix(prefix);
  }

  registerField(path: string, config: BitFieldDefinition<T>) {
    this.depsMg.register(path, config, this.state.values);
    if (this.depsMg.isHidden(path)) {
      this.notify();
    }
  }

  isHidden<P extends BitPath<T>>(path: P): boolean {
    return this.depsMg.isHidden(path);
  }

  isRequired<P extends BitPath<T>>(path: P): boolean {
    return this.depsMg.isRequired(path, this.state.values);
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
    const { visibilitiesChanged } = this.lifecycleMg.updateField(path, value);

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

    this.validatorMg.trigger([path]);
  }

  markFieldsTouched(paths: string[]) {
    if (paths.length === 0) return;
    const newTouched = { ...this.state.touched };
    paths.forEach((path) => (newTouched[path] = true));
    this.internalUpdateState({ touched: newTouched });
  }

  setValues(newValues: T) {
    this.lifecycleMg.updateAll(newValues);
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
    this.lifecycleMg.reset();
  }

  registerMask(name: string, mask: BitMask) {
    this.config.masks![name] = mask;
  }

  pushItem<P extends BitArrayPath<T>>(
    path: P,
    value: BitArrayItem<BitPathValue<T, P>>,
  ) {
    this.arraysMg.pushItem(path, value);
  }
  prependItem<P extends BitArrayPath<T>>(
    path: P,
    value: BitArrayItem<BitPathValue<T, P>>,
  ) {
    this.arraysMg.prependItem(path, value);
  }
  insertItem<P extends BitArrayPath<T>>(
    path: P,
    index: number,
    value: BitArrayItem<BitPathValue<T, P>>,
  ) {
    this.arraysMg.insertItem(path, index, value);
  }
  removeItem<P extends BitArrayPath<T>>(path: P, index: number) {
    this.arraysMg.removeItem(path, index);
  }
  swapItems<P extends BitArrayPath<T>>(
    path: P,
    indexA: number,
    indexB: number,
  ) {
    this.arraysMg.swapItems(path, indexA, indexB);
  }
  moveItem<P extends BitArrayPath<T>>(path: P, from: number, to: number) {
    this.arraysMg.moveItem(path, from, to);
  }

  get canUndo(): boolean {
    return this.historyMg.canUndo;
  }
  get canRedo(): boolean {
    return this.historyMg.canRedo;
  }

  undo() {
    const prevState = this.historyMg.undo();
    if (prevState) {
      const isDirty = this.dirtyMg.rebuild(
        prevState,
        this.config.initialValues,
      );
      this.internalUpdateState({ values: prevState, isDirty });
      this.validatorMg.validate();
    }
  }

  redo() {
    const nextState = this.historyMg.redo();
    if (nextState) {
      const isDirty = this.dirtyMg.rebuild(
        nextState,
        this.config.initialValues,
      );
      this.internalUpdateState({ values: nextState, isDirty });
      this.validatorMg.validate();
    }
  }

  validate(options?: {
    scope?: string;
    scopeFields?: string[];
  }): Promise<boolean> {
    return this.validatorMg.validate(options);
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
    return this.lifecycleMg.submit(onSuccess);
  }

  internalUpdateState(partialState: Partial<BitState<T>>) {
    let nextState = { ...this.state, ...partialState };

    if (partialState.values) {
      nextState.values = this.computedMg.apply(partialState.values);
    }

    if (partialState.errors) {
      nextState.isValid = Object.keys(nextState.errors).length === 0;
    }

    this.state = nextState;
    this.notify();

    bitBus.dispatch(this.storeId, this.state);
  }

  internalSaveSnapshot() {
    this.historyMg.saveSnapshot(this.state.values);
  }

  cleanup() {
    this.listeners.clear();
    this.validatorMg.cancelAll();

    delete bitBus.stores[this.storeId];
  }

  private notify() {
    this.listeners.forEach((listener) => listener());
  }
}
