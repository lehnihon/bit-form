import { bitBus } from "./bus";
import { BitMask, BitMaskName } from "../mask/types";
import {
  BitConfig,
  BitComputedFn,
  BitErrors,
  BitFieldState,
  BitTransformFn,
  BitState,
  BitFieldDefinition,
  BitPath,
  BitPathValue,
  BitArrayPath,
  BitArrayItem,
  DeepPartial,
  BitFieldChangeMeta,
  BitFieldChangeEvent,
  BitBeforeValidateEvent,
  BitAfterValidateEvent,
  BitBeforeSubmitEvent,
  BitAfterSubmitEvent,
} from "./types";
import type {
  BitHistoryMetadata,
  BitSelector,
  BitSelectorSubscriptionOptions,
  BitValidationOptions,
} from "./public-types";
import {
  BitResolvedConfig,
  BitStoreAdapter,
  SelectorListenerEntry,
  BitValidationAdapter,
  BitLifecycleAdapter,
} from "./internal-types";
import { deepClone, deepEqual, getDeepValue, valueEqual } from "../utils";
import { normalizeConfig } from "./config";
import { BitDependencyManager } from "./dependency-manager";
import { BitHistoryManager } from "./history-manager";
import { BitArrayManager } from "./array-manager";
import { BitComputedManager } from "./computed-manager";
import { BitValidationManager } from "./validation-manager";
import { BitLifecycleManager } from "./lifecycle-manager";
import { BitDirtyManager } from "./dirty-manager";
import { BitScopeManager } from "./scope-manager";
import { BitFieldQueryManager } from "./field-query-manager";
import { BitErrorManager } from "./error-manager";
import { BitPersistManager } from "./persist-manager";
import { BitPluginManager } from "./plugin-manager";
import { createDevtoolsPlugin } from "./devtools-plugin";
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
  private selectorListeners: Set<SelectorListenerEntry<T>> = new Set();
  private pathScopedSubscriptions: Map<SelectorListenerEntry<T>, string[]> =
    new Map();
  private pathSelectorIndex: Map<string, Set<SelectorListenerEntry<T>>> =
    new Map();
  private persistMg: BitPersistManager<T>;
  private pluginMg: BitPluginManager<T>;

  // ============================================================================
  // PUBLIC PROPERTIES
  // ============================================================================

  public config: BitResolvedConfig<T>;
  public storeId: string;

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  // Core Managers
  // Managers for essential form state management
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

  private readonly depsMg: BitDependencyManager<T>;
  private readonly validatorMg: BitValidationManager<T>;
  private readonly computedMg: BitComputedManager<T>;
  private readonly dirtyMg: BitDirtyManager<T>;
  private readonly lifecycleMg: BitLifecycleManager<T>;

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  // Feature Managers
  // Managers for optional features like history, arrays, and scopes
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

  private readonly historyMg: BitHistoryManager<T>;
  private readonly arraysMg: BitArrayManager<T>;
  private readonly scopeMg: BitScopeManager<T>;

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  // Query & Mutation Managers
  // Dedicated managers for specific operations
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

  private readonly queryMg: BitFieldQueryManager<T>;
  private readonly errorMg: BitErrorManager<T>;

  // ============================================================================
  // CONSTRUCTOR
  // ============================================================================

  constructor(config: BitConfig<T> = {}) {
    this.config = normalizeConfig(config);

    // Initialize core managers
    this.depsMg = new BitDependencyManager<T>();
    this.computedMg = new BitComputedManager<T>(() =>
      this.getComputedEntries(),
    );
    this.validatorMg = new BitValidationManager<T>(this);
    this.dirtyMg = new BitDirtyManager<T>();
    this.lifecycleMg = new BitLifecycleManager<T>(this);

    // Initialize feature managers
    this.historyMg = new BitHistoryManager<T>(
      !!this.config.enableHistory,
      this.config.historyLimit ?? 15,
    );
    this.arraysMg = new BitArrayManager<T>(this);

    // Initialize query/mutation managers with state access
    this.scopeMg = new BitScopeManager<T>(
      () => this.state,
      () => this.config.initialValues,
      (scopeName) => this.getScopeFields(scopeName),
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
    this.persistMg = new BitPersistManager<T>(
      this.config.persist,
      () => this.state.values,
      () => this.getDirtyValues(),
      (values) => this.applyPersistedValues(values),
    );

    // Initialize form state
    const initialValues = deepClone(this.config.initialValues);

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

    this.internalSaveSnapshot();

    this.storeId =
      config.storeId ||
      this.config.name ||
      `bit-form-${Math.random().toString(36).substring(2, 9)}`;

    const runtimePlugins = [...this.config.plugins];
    const devtoolsPlugin = createDevtoolsPlugin<T>(this.config.devTools);
    if (devtoolsPlugin) {
      runtimePlugins.push(devtoolsPlugin);
    }

    this.pluginMg = new BitPluginManager<T>(runtimePlugins, () => ({
      storeId: this.storeId,
      getState: () => this.getState(),
      getConfig: () => this.getConfig(),
    }));
    this.pluginMg.setupAll();

    // Register store in global bus
    bitBus.stores[this.storeId] = this;
  }

  // ============================================================================
  // STATE ACCESS
  // ============================================================================

  getConfig() {
    return this.config;
  }

  getFieldConfig(path: string): BitFieldDefinition<T> | undefined {
    return (
      this.depsMg.fieldConfigs.get(path) ||
      this.config.fields?.[path as keyof typeof this.config.fields]
    );
  }

  getScopeFields(scopeName: string): string[] {
    const result: string[] = [];

    this.depsMg.fieldConfigs.forEach((cfg, path) => {
      if (cfg.scope === scopeName) {
        result.push(path);
      }
    });

    return result;
  }

  getComputedEntries(): [string, BitComputedFn<T>][] {
    const result: [string, BitComputedFn<T>][] = [];

    this.depsMg.fieldConfigs.forEach((cfg, path) => {
      if (cfg.computed) {
        result.push([path, cfg.computed]);
      }
    });

    return result;
  }

  getTransformEntries(): [string, BitTransformFn<T>][] {
    const result: [string, BitTransformFn<T>][] = [];

    this.depsMg.fieldConfigs.forEach((cfg, path) => {
      if (cfg.transform) {
        result.push([path, cfg.transform]);
      }
    });

    return result;
  }

  resolveMask(path: string): BitMask | undefined {
    const maskOption = this.getFieldConfig(path)?.mask;
    if (!maskOption) return undefined;

    if (typeof maskOption === "string") {
      return this.config.masks?.[maskOption];
    }

    return maskOption;
  }

  getState(): BitState<T> {
    return this.state;
  }

  getFieldState<P extends BitPath<T>>(
    path: P,
  ): BitFieldState<T, BitPathValue<T, P>> {
    const value = getDeepValue(
      this.state.values,
      path as string,
    ) as BitPathValue<T, P>;

    return {
      value,
      error: this.state.errors[path as keyof BitErrors<T>],
      touched: !!this.state.touched[path as keyof typeof this.state.touched],
      isHidden: this.isHidden(path),
      isRequired: this.isRequired(path),
      isDirty: this.isFieldDirty(path as string),
      isValidating: this.isFieldValidating(path as string),
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

  subscribeSelector<TSlice>(
    selector: BitSelector<T, TSlice>,
    listener: (slice: TSlice) => void,
    options?: BitSelectorSubscriptionOptions<TSlice>,
  ) {
    const equalityFn = options?.equalityFn ?? valueEqual;
    let lastSlice = selector(this.state);

    const subscription: SelectorListenerEntry<T> = {
      notify: (nextState) => {
        const nextSlice = selector(nextState);

        if (equalityFn(lastSlice, nextSlice)) {
          return;
        }

        lastSlice = nextSlice;
        listener(nextSlice);
      },
    };

    const autoTrackedPaths =
      options?.autoTrackPaths === false
        ? []
        : this.collectTrackedSelectorPaths(selector);

    const scopedPaths = this.normalizeSubscriptionPaths([
      ...(options?.paths ?? []),
      ...autoTrackedPaths,
    ]);

    if (scopedPaths.length > 0) {
      this.pathScopedSubscriptions.set(subscription, scopedPaths);
      scopedPaths.forEach((pathKey) => {
        const listeners = this.pathSelectorIndex.get(pathKey) ?? new Set();
        listeners.add(subscription);
        this.pathSelectorIndex.set(pathKey, listeners);
      });
    } else {
      this.selectorListeners.add(subscription);
    }

    if (options?.emitImmediately) {
      listener(lastSlice);
    }

    return () => {
      this.selectorListeners.delete(subscription);

      const paths = this.pathScopedSubscriptions.get(subscription);
      if (!paths) return;

      paths.forEach((pathKey) => {
        const listeners = this.pathSelectorIndex.get(pathKey);
        if (!listeners) return;

        listeners.delete(subscription);
        if (listeners.size === 0) {
          this.pathSelectorIndex.delete(pathKey);
        }
      });

      this.pathScopedSubscriptions.delete(subscription);
    };
  }

  subscribePath<P extends BitPath<T>>(
    path: P,
    listener: (value: BitPathValue<T, P>) => void,
    options?: BitSelectorSubscriptionOptions<BitPathValue<T, P>>,
  ) {
    const mergedPaths = [...(options?.paths ?? []), path as string];

    return this.subscribeSelector(
      (state) =>
        getDeepValue(state.values, path as string) as BitPathValue<T, P>,
      listener,
      {
        ...options,
        paths: mergedPaths,
      },
    );
  }

  watch<P extends BitPath<T>>(
    path: P,
    callback: (value: BitPathValue<T, P>) => void,
  ) {
    return this.subscribePath(path, callback, {
      equalityFn: deepEqual,
    });
  }

  // ============================================================================
  // FIELD VALUE MUTATIONS
  // ============================================================================

  setField<P extends BitPath<T>>(path: P, value: BitPathValue<T, P>) {
    this.setFieldWithMeta(path as string, value, { origin: "setField" });
  }

  setFieldWithMeta(
    path: string,
    value: any,
    meta: BitFieldChangeMeta = { origin: "setField" },
  ) {
    this.lifecycleMg.updateField(path, value, meta);
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

  replaceValues(newValues: T) {
    this.lifecycleMg.replaceValues(newValues);
  }

  hydrate(values: DeepPartial<T>) {
    this.lifecycleMg.hydrateValues(values);
  }

  rebase(newValues: T) {
    this.lifecycleMg.rebaseValues(newValues);
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

  registerMask(name: BitMaskName, mask: BitMask) {
    this.config.masks = {
      ...(this.config.masks || {}),
      [name]: mask,
    };
  }

  getDirtyValues(): Partial<T> {
    return this.dirtyMg.buildDirtyValues(this.state.values);
  }

  async restorePersisted(): Promise<boolean> {
    return this.persistMg.restore();
  }

  async forceSave(): Promise<void> {
    await this.persistMg.saveNow();
  }

  async clearPersisted(): Promise<void> {
    await this.persistMg.clear();
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

  getHistoryMetadata(): BitHistoryMetadata {
    return this.historyMg.getMetadata();
  }

  // ============================================================================
  // VALIDATION & SCOPES
  // ============================================================================

  validate(options?: BitValidationOptions): Promise<boolean> {
    return this.validatorMg.validate(options);
  }

  emitBeforeValidate(event: BitBeforeValidateEvent<T>): Promise<void> {
    return this.pluginMg.beforeValidate(event);
  }

  emitAfterValidate(event: BitAfterValidateEvent<T>): Promise<void> {
    return this.pluginMg.afterValidate(event);
  }

  emitBeforeSubmit(event: BitBeforeSubmitEvent<T>): Promise<void> {
    return this.pluginMg.beforeSubmit(event);
  }

  emitAfterSubmit(event: BitAfterSubmitEvent<T>): Promise<void> {
    return this.pluginMg.afterSubmit(event);
  }

  emitFieldChange(event: BitFieldChangeEvent<T>) {
    this.pluginMg.onFieldChange(event);
  }

  emitOperationalError(event: {
    source: "submit";
    error: unknown;
    payload?: unknown;
  }) {
    return this.pluginMg.reportError(event.source, event.error, event.payload);
  }

  hasValidationsInProgress(scopeFields?: string[]): boolean {
    return this.validatorMg.hasValidationsInProgress(scopeFields);
  }

  triggerValidation(scopeFields?: string[]) {
    this.validatorMg.trigger(scopeFields);
  }

  getStepStatus(scopeName: string) {
    return this.scopeMg.getStepStatus(scopeName);
  }

  getStepErrors(scopeName: string): Record<string, string> {
    return this.scopeMg.getStepErrors(scopeName);
  }

  updateDependencies(changedPath: string, newValues: T): string[] {
    return this.depsMg.updateDependencies(changedPath, newValues);
  }

  isFieldHidden(path: string): boolean {
    return this.depsMg.isHidden(path);
  }

  evaluateAllDependencies(values: T): void {
    this.depsMg.evaluateAll(values);
  }

  getHiddenFields(): string[] {
    return Array.from(this.depsMg.hiddenFields);
  }

  getRequiredErrors(values: T): BitErrors<T> {
    return this.depsMg.getRequiredErrors(values);
  }

  clearFieldValidation(path: string): void {
    this.validatorMg.clear(path);
  }

  handleFieldAsyncValidation(path: string, value: any): void {
    this.validatorMg.handleAsync(path, value);
  }

  cancelAllValidations(): void {
    this.validatorMg.cancelAll();
  }

  validateNow(options?: BitValidationOptions): Promise<boolean> {
    return this.validatorMg.validate(options);
  }

  updateDirtyForPath(path: string, nextValues: T, baselineValues: T): boolean {
    return this.dirtyMg.updateForPath(path, nextValues, baselineValues);
  }

  rebuildDirtyState(nextValues: T, baselineValues: T): boolean {
    return this.dirtyMg.rebuild(nextValues, baselineValues);
  }

  clearDirtyState(): void {
    this.dirtyMg.clear();
  }

  buildDirtyValues(values: T): Partial<T> {
    return this.dirtyMg.buildDirtyValues(values);
  }

  resetHistory(initialValues: T): void {
    this.historyMg.reset(initialValues);
  }

  // ============================================================================
  // INTERNAL OPERATIONS
  // ============================================================================

  internalUpdateState(
    partialState: Partial<BitState<T>>,
    changedPaths?: string[],
  ) {
    const previousState = this.state;
    let nextState = { ...this.state, ...partialState };

    if (partialState.values) {
      nextState.values = this.computedMg.apply(partialState.values);
    }

    if (partialState.errors) {
      nextState.isValid = Object.keys(nextState.errors).length === 0;
    }

    this.state = nextState;

    if (partialState.values) {
      this.persistMg.queueSave();
    }

    const effectiveChangedPaths =
      changedPaths && changedPaths.length > 0
        ? changedPaths
        : partialState.values
          ? ["*"]
          : undefined;

    this.notify(previousState, nextState, effectiveChangedPaths);

    bitBus.dispatch(this.storeId, this.state);
  }

  internalSaveSnapshot() {
    this.historyMg.saveSnapshot(this.state.values);
  }

  private applyPersistedValues(values: Partial<T>) {
    const nextValues = deepClone({
      ...this.config.initialValues,
      ...values,
    } as T);

    this.validatorMg.cancelAll();
    this.depsMg.evaluateAll(nextValues);

    const isDirty = this.dirtyMg.rebuild(nextValues, this.config.initialValues);

    this.internalUpdateState({
      values: nextValues,
      errors: {},
      touched: {},
      isValidating: {},
      isValid: true,
      isDirty,
      isSubmitting: false,
    });

    this.internalSaveSnapshot();
    this.validatorMg.validate();
  }

  cleanup() {
    this.listeners.clear();
    this.selectorListeners.clear();
    this.pathScopedSubscriptions.clear();
    this.pathSelectorIndex.clear();
    this.validatorMg.cancelAll();
    this.persistMg.destroy();
    this.pluginMg.destroy();

    delete bitBus.stores[this.storeId];
  }

  private notify(
    previousState: BitState<T> = this.state,
    nextState: BitState<T> = this.state,
    changedPaths?: string[],
  ) {
    this.listeners.forEach((listener) => listener());

    this.selectorListeners.forEach((subscription) => {
      subscription.notify(nextState);
    });

    if (this.pathScopedSubscriptions.size === 0) {
      return;
    }

    if (
      !changedPaths ||
      changedPaths.length === 0 ||
      changedPaths.includes("*")
    ) {
      this.pathScopedSubscriptions.forEach((_paths, subscription) => {
        subscription.notify(nextState);
      });
      return;
    }

    const scopedSubscribers =
      this.collectSubscribersForChangedPaths(changedPaths);

    scopedSubscribers.forEach((subscription) => {
      subscription.notify(nextState);
    });
  }

  private normalizeSubscriptionPaths(paths?: string[]): string[] {
    if (!paths || paths.length === 0) return [];

    return Array.from(
      new Set(
        paths.map((path) => path.trim()).filter((path) => path.length > 0),
      ),
    );
  }

  private collectTrackedSelectorPaths<TSlice>(
    selector: BitSelector<T, TSlice>,
  ): string[] {
    const trackedPaths = new Set<string>();

    const createTrackedProxy = (
      value: unknown,
      currentPath: string,
    ): unknown => {
      if (!value || typeof value !== "object") {
        return value;
      }

      return new Proxy(value as Record<string, unknown>, {
        get: (target, key) => {
          if (typeof key !== "string") {
            return Reflect.get(target, key);
          }

          const nextPath = currentPath ? `${currentPath}.${key}` : key;
          trackedPaths.add(nextPath);

          const nextValue = Reflect.get(target, key);
          return createTrackedProxy(nextValue, nextPath);
        },
      });
    };

    const trackedState = new Proxy(
      this.state as unknown as Record<string, unknown>,
      {
        get: (target, key) => {
          if (typeof key !== "string") {
            return Reflect.get(target, key);
          }

          const value = Reflect.get(target, key);

          if (key === "values") {
            return createTrackedProxy(value, "");
          }

          return value;
        },
      },
    ) as Readonly<BitState<T>>;

    try {
      selector(trackedState);
      return Array.from(trackedPaths);
    } catch {
      return [];
    }
  }

  private collectSubscribersForChangedPaths(
    changedPaths: string[],
  ): Set<SelectorListenerEntry<T>> {
    const scopedSubscribers = new Set<SelectorListenerEntry<T>>();

    const addByPath = (path: string) => {
      const listeners = this.pathSelectorIndex.get(path);
      if (!listeners) return;
      listeners.forEach((subscription) => scopedSubscribers.add(subscription));
    };

    const normalizedChangedPaths =
      this.normalizeSubscriptionPaths(changedPaths);

    normalizedChangedPaths.forEach((changedPath) => {
      addByPath(changedPath);

      const parts = changedPath.split(".");
      while (parts.length > 1) {
        parts.pop();
        addByPath(parts.join("."));
      }

      this.pathSelectorIndex.forEach((listeners, indexedPath) => {
        if (indexedPath.startsWith(`${changedPath}.`)) {
          listeners.forEach((subscription) =>
            scopedSubscribers.add(subscription),
          );
        }
      });
    });

    return scopedSubscribers;
  }
}
