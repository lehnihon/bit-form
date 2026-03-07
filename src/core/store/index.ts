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
import { BitScopeManager } from "./scope-manager";
import { BitFieldQueryManager } from "./field-query-manager";
import { BitErrorManager } from "./error-manager";

/**
 * BitStore
 *
 * The core orchestrator of form state management.
 *
 * This store coordinates multiple managers to provide comprehensive form handling:
 * - Core managers handle essential state and validation
 * - Feature managers provide optional enhancements (history, arrays, scopes)
 * - Query/mutation managers organize domain-specific operations
 */
export class BitStore<T extends object = any>
  implements BitStoreAdapter<T>, BitValidationAdapter<T>, BitLifecycleAdapter<T>
{
  // ============================================================================
  // PRIVATE PROPERTIES
  // ============================================================================

  private state: BitState<T>;
  private listeners: Set<() => void> = new Set();

  // ============================================================================
  // PUBLIC PROPERTIES
  // ============================================================================

  public config: BitResolvedConfig<T>;
  public storeId: string;

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  // Core Managers
  // Managers for essential form state management
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

  public depsMg: BitDependencyManager<T>;
  public validatorMg: BitValidationManager<T>;
  public computedMg: BitComputedManager<T>;
  public dirtyMg: BitDirtyManager<T>;
  public lifecycleMg: BitLifecycleManager<T>;

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  // Feature Managers
  // Managers for optional features like history, arrays, and scopes
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

  public historyMg: BitHistoryManager<T>;
  public arraysMg: BitArrayManager<T>;
  public scopeMg: BitScopeManager<T>;
  public devtoolsMg: BitDevtoolsManager<T>;

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  // Query & Mutation Managers
  // Dedicated managers for specific operations
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

  public queryMg: BitFieldQueryManager<T>;
  public errorMg: BitErrorManager<T>;

  // ============================================================================
  // CONSTRUCTOR
  // ============================================================================

  constructor(config: BitConfig<T> = {}) {
    this.config = normalizeConfig(config);

    // Initialize core managers
    this.depsMg = new BitDependencyManager<T>();
    this.computedMg = new BitComputedManager<T>(this.config);
    this.validatorMg = new BitValidationManager<T>(this);
    this.dirtyMg = new BitDirtyManager<T>();
    this.lifecycleMg = new BitLifecycleManager<T>(this);

    // Initialize feature managers
    this.historyMg = new BitHistoryManager<T>(
      !!this.config.enableHistory,
      this.config.historyLimit ?? 15,
    );
    this.arraysMg = new BitArrayManager<T>(this);
    this.devtoolsMg = new BitDevtoolsManager<T>(this);

    // Initialize query/mutation managers with state access
    this.scopeMg = new BitScopeManager<T>(
      () => this.state,
      () => this.config,
    );
    this.queryMg = new BitFieldQueryManager<T>(
      this.depsMg,
      () => this.state,
      () => this.config,
    );
    this.errorMg = new BitErrorManager<T>(
      () => this.state,
      (partial) => this.internalUpdateState(partial),
    );

    // Initialize form state
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

    // Register initial fields from config
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

    // Register store in global bus
    this.storeId =
      this.config.name ||
      `bit-form-${Math.random().toString(36).substring(2, 9)}`;
    bitBus.stores[this.storeId] = this;
  }

  // ============================================================================
  // STATE ACCESS
  // ============================================================================

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

  // ============================================================================
  // FIELD REGISTRATION & CLEANUP
  // ============================================================================

  registerField(path: string, config: BitFieldDefinition<T>) {
    this.depsMg.register(path, config, this.state.values);
    if (this.depsMg.isHidden(path)) {
      this.notify();
    }
  }

  unregisterField<P extends BitPath<T>>(path: P) {
    // Fields from initial config are never unregistered
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

  // ============================================================================
  // FIELD QUERIES (Delegated to queryMg)
  // ============================================================================

  isHidden<P extends BitPath<T>>(path: P): boolean {
    return this.queryMg.isHidden(path);
  }

  isRequired<P extends BitPath<T>>(path: P): boolean {
    return this.queryMg.isRequired(path);
  }

  isFieldDirty(path: string): boolean {
    return this.queryMg.isFieldDirty(path);
  }

  isFieldValidating(path: string): boolean {
    return this.queryMg.isFieldValidating(path);
  }

  // ============================================================================
  // SUBSCRIPTIONS & WATCHERS
  // ============================================================================

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

  // ============================================================================
  // FIELD VALUE MUTATIONS
  // ============================================================================

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

  // ============================================================================
  // ERROR MANAGEMENT (Delegated to errorMg)
  // ============================================================================

  setError(path: string, message: string | undefined) {
    this.errorMg.setError(path, message);
  }

  setErrors(errors: BitErrors<T>) {
    this.errorMg.setErrors(errors);
  }

  setServerErrors(serverErrors: Record<string, string[] | string>) {
    this.errorMg.setServerErrors(serverErrors);
  }

  // ============================================================================
  // FORM-LEVEL OPERATIONS
  // ============================================================================

  reset() {
    this.lifecycleMg.reset();
  }

  async submit(
    onSuccess: (values: T, dirtyValues?: Partial<T>) => void | Promise<void>,
  ) {
    return this.lifecycleMg.submit(onSuccess);
  }

  registerMask(name: string, mask: BitMask) {
    this.config.masks![name] = mask;
  }

  getDirtyValues(): Partial<T> {
    return this.dirtyMg.buildDirtyValues(this.state.values);
  }

  // ============================================================================
  // ARRAY OPERATIONS (Delegated to arraysMg)
  // ============================================================================

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

  // ============================================================================
  // HISTORY & TIME-TRAVEL (Delegated to historyMg)
  // ============================================================================

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

  getHistoryMetadata(): {
    enabled: boolean;
    canUndo: boolean;
    canRedo: boolean;
    historyIndex: number;
    historySize: number;
  } {
    return this.historyMg.getMetadata();
  }

  // ============================================================================
  // VALIDATION & SCOPES
  // ============================================================================

  validate(options?: {
    scope?: string;
    scopeFields?: string[];
  }): Promise<boolean> {
    return this.validatorMg.validate(options);
  }

  getStepStatus(scopeName: string) {
    return this.scopeMg.getStepStatus(scopeName);
  }

  getStepErrors(scopeName: string): Record<string, string> {
    return this.scopeMg.getStepErrors(scopeName);
  }

  // ============================================================================
  // INTERNAL OPERATIONS
  // ============================================================================

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
