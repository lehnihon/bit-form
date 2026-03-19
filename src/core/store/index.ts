import { BitMask, BitMaskName } from "../mask/types";
import {
  BitConfig,
  BitComputedFn,
  BitErrors,
  BitPersistMetadata,
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
} from "./contracts/types";
import type {
  BitFrameworkConfig,
  BitHistoryMetadata,
  BitSelector,
  BitSelectorSubscriptionOptions,
  BitValidationOptions,
} from "./contracts/public-types";
import { deepClone, deepEqual, getDeepValue, valueEqual } from "../utils";
import { normalizeConfig } from "./shared/config";
import { BitDependencyManager } from "./managers/core/dependency-manager";
import {
  BitComputedEntry,
  BitComputedManager,
} from "./managers/core/computed-manager";
import { BitDirtyManager } from "./managers/core/dirty-manager";
import { BitMaskManager } from "./managers/features/mask-manager";
import { BitSubscriptionEngine } from "./engines/subscription-engine";
import {
  beginStoreBatch,
  createStoreBatchState,
  endStoreBatch,
  flushStoreBatchState,
  getEffectiveStoreState,
  trackBatchedStoreUpdate,
  type BitStoreBatchState,
} from "./engines/store-batch-engine";
import {
  createStoreFieldIndexState,
  getComputedEntries,
  getScopeFields,
  getTransformEntries,
  invalidateStoreFieldIndexes,
  registerCachedFieldIndexes,
  type BitStoreFieldIndexState,
  unregisterCachedFieldIndexes,
} from "./engines/store-field-index-engine";
import {
  createFieldStateSnapshot,
  resolveFieldMask,
} from "./engines/store-field-query-engine";
import { executeStoreOperation } from "./engines/store-dispatch-engine";
import {
  BitStoreOperation,
  historyApplyOperation,
  patchStateOperation,
  persistMetaOperation,
  touchFieldsOperation,
} from "./engines/operation-engine";
import { BitStoreEffectEngine } from "./engines/effect-engine";
import { BitCapabilityRegistry } from "./orchestration/capability-registry";
import type { BitStoreCapabilities } from "./orchestration/capabilities";
import type { BitValidationTriggerOptions } from "./managers/features/validation-manager";
import {
  createInitialStoreState,
  createStoreCapabilities,
  createStoreEffects,
} from "./orchestration/store-bootstrap";
/**
 * BitStore
 *
 * The core orchestrator of form state management.
 *
 * This store coordinates multiple managers to provide comprehensive form handling:
 * - Core managers handle essential state and validation
 * - Feature managers provide optional enhancements (history, arrays, scopes)
 * - Query/mutation managers organize domain-specific operations
 *
 * ## Public API Methods (50+)
 *
 * ### State Management
 * - getConfig(), getState(): Get current configuration and state
 * - subscribe(): Register listeners for state changes
 * - transaction(): Batch multiple mutations and notify once
 *
 * ### Field Operations
 * - setField(), blurField(): Update individual field values
 * - replaceValues(), hydrate(), rebase(): Replace entire form state
 * - registerField(), unregisterField(): Register/cleanup field configs
 * - setError(), setErrors(), setServerErrors(): Set field errors
 *
 * ### Validation
 * - validate(): Run field/form validation pipeline
 * - isHidden(), isRequired(), isFieldValidating(): Field metadata queries
 *
 * ### History & Persistence
 * - reset(): Reset to initial values (clears history if enabled)
 * - undo(), redo(): History navigation (if history enabled)
 * - restorePersisted(), forceSave(), clearPersisted(): Persistence controls
 * - getPersistMetadata(), getHistoryMetadata(): Metadata access
 *
 * ### Masks
 * - registerMask(), unregisterMask(): Register/unregister input masks
 * - resolveMask(): Get mask configuration for a field
 *
 * ### Arrays (if arrays feature enabled)
 * - pushItem(), prependItem(), insertItem(), removeItem(): Array mutations
 * - moveItem(), swapItems(): Array reordering
 *
 * ### Scopes/Steps (if steps feature enabled)
 * - getStepStatus(), getStepErrors(): Scope metadata queries
 *
 * ### Watchers & Cleanup
 * - watch(): Subscribe to specific field changes
 * - isFieldDirty(): Check if field differs from initialValues
 * - getDirtyValues(): Get only changed field values
 * - cleanup(): Cleanup all resources
 *
 * ### Form Submission
 * - submit(): Execute form submit handler with hooks
 *
 * ## Internal Architecture
 *
 * ### Managers (organized by responsibility)
 * - **Core**: BitDependencyManager, BitComputedManager, BitDirtyManager
 * - **Features**: BitValidationManager, BitHistoryManager, BitArrayManager,
 *   BitScopeManager, BitPersistManager, BitLifecycleManager
 *
 * ### Engines (operational subsystems)
 * - **BitSubscriptionEngine**: Path-scoped pub/sub with wildcard expansion
 * - **BitStateUpdateEngine**: Granular state mutation and changed path tracking
 * - **BitStoreEffectEngine**: Side-effect orchestration (validation triggers, hooks)
 *
 * ### Caching & Indexing
 * - scopeFieldsIndex: Maps scope names → field paths (invalidated on registerField)
 * - computedEntriesCache: Cached computed field entries for iteration
 * - transformEntriesCache: Cached transform entries
 * - _masksVersion: Incremented on mask changes (tracks config changes without state)
 *
 * ## Performance Considerations
 *
 * - **Batch Updates**: transaction() defers subscriptions until batch completes
 * - **Lazy Evaluation**: Computed fields only run when dependencies change
 * - **Subscription Optimization**: Listeners only notified for affected paths
 * - **Memory**: Cleanup properly via cleanup() to prevent leaks with dynamic fields
 */
export class BitStore<T extends object = any> {
  // ============================================================================
  // PRIVATE PROPERTIES
  // ============================================================================

  private state: BitState<T>;
  private readonly subscriptions: BitSubscriptionEngine<T>;
  private readonly effects: BitStoreEffectEngine<T>;
  private readonly capabilities: BitCapabilityRegistry<BitStoreCapabilities<T>>;
  private readonly maskManager: BitMaskManager;
  /** Baseline for dirty tracking. Decoupled from config so that rebaseValues
   * can update it without mutating the user-provided config object. */
  private _initialValues!: T;

  // ============================================================================
  // PUBLIC PROPERTIES
  // ============================================================================

  public config: BitFrameworkConfig<T>;
  public readonly storeId: string;

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  // Core Managers
  // Managers for essential form state management
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

  private readonly dependencyManager: BitDependencyManager<T>;
  private readonly computedManager: BitComputedManager<T>;
  private readonly dirtyManager: BitDirtyManager<T>;
  private readonly fieldIndexState: BitStoreFieldIndexState<T> =
    createStoreFieldIndexState<T>();
  private readonly batchState: BitStoreBatchState<T> =
    createStoreBatchState<T>();

  private invalidateFieldIndexes() {
    invalidateStoreFieldIndexes(this.fieldIndexState);
    this.computedManager.invalidateReverseDeps();
  }

  private registerCachedFieldIndexes(
    path: string,
    config: BitFieldDefinition<T>,
  ) {
    registerCachedFieldIndexes({
      fieldIndexState: this.fieldIndexState,
      path,
      config,
    });
  }

  private unregisterCachedFieldIndexes(
    path: string,
    config?: BitFieldDefinition<T>,
  ) {
    if (!config) {
      this.invalidateFieldIndexes();
      return;
    }

    unregisterCachedFieldIndexes({
      fieldIndexState: this.fieldIndexState,
      path,
      config,
    });
  }

  private getCapability<TKey extends keyof BitStoreCapabilities<T>>(key: TKey) {
    return this.capabilities.get(key);
  }

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  // Feature Managers
  // Managers for optional features like history, arrays, and scopes
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

  private get validation() {
    return this.getCapability("validation");
  }

  private get lifecycle() {
    return this.getCapability("lifecycle");
  }

  private get history() {
    return this.getCapability("history");
  }

  private get arrays() {
    return this.getCapability("arrays");
  }

  private get scope() {
    return this.getCapability("scope");
  }

  private get query() {
    return this.getCapability("query");
  }

  private get error() {
    return this.getCapability("error");
  }

  // ============================================================================
  // CONSTRUCTOR
  // ============================================================================

  constructor(config: BitConfig<T> = {}) {
    this.config = normalizeConfig(config);
    this._initialValues = this.config.initialValues;

    // Initialize core managers
    this.dependencyManager = new BitDependencyManager<T>();
    this.computedManager = new BitComputedManager<T>(() =>
      this.getComputedEntries(),
    );
    this.dirtyManager = new BitDirtyManager<T>();
    this.maskManager = new BitMaskManager();
    this.capabilities = createStoreCapabilities<T>({
      store: this,
      dependencyManager: this.dependencyManager,
      dirtyManager: this.dirtyManager,
    });
    this.state = createInitialStoreState<T>({
      config: this.config,
      dependencyManager: this.dependencyManager,
      computedManager: this.computedManager,
    });
    this.subscriptions = new BitSubscriptionEngine<T>(() => this.state);

    this.internalSaveSnapshot();

    this.storeId =
      config.storeId ||
      this.config.name ||
      this.config.idFactory({
        scope: "store",
        storeName: this.config.name,
      });

    this.effects = createStoreEffects<T>({
      storeId: this.storeId,
      storeInstance: this,
      config: this.config,
      getState: () => this.getState(),
      getConfig: () => this.getConfig(),
      getValues: () => this.state.values,
      getDirtyValues: () => this.getDirtyValues(),
      applyPersistedValues: (values) => this.applyPersistedValues(values),
    });
  }

  // ============================================================================
  // STATE ACCESS
  // ============================================================================

  getConfig() {
    return this.config;
  }

  getFieldConfig(path: string): BitFieldDefinition<T> | undefined {
    return (
      this.dependencyManager.getFieldConfig(path) ||
      this.config.fields?.[path as keyof typeof this.config.fields]
    );
  }

  getScopeFields(scopeName: string): string[] {
    return getScopeFields({
      fieldIndexState: this.fieldIndexState,
      scopeName,
      forEachFieldConfig: (iteratee) =>
        this.dependencyManager.forEachFieldConfig(iteratee),
    });
  }

  getComputedEntries(): BitComputedEntry<T>[] {
    return getComputedEntries({
      fieldIndexState: this.fieldIndexState,
      forEachFieldConfig: (iteratee) =>
        this.dependencyManager.forEachFieldConfig(iteratee),
    });
  }

  getTransformEntries(): [string, BitTransformFn<T>][] {
    return getTransformEntries({
      fieldIndexState: this.fieldIndexState,
      forEachFieldConfig: (iteratee) =>
        this.dependencyManager.forEachFieldConfig(iteratee),
    });
  }

  resolveMask(path: string): BitMask | undefined {
    return resolveFieldMask({
      path,
      getFieldConfig: (fieldPath) => this.getFieldConfig(fieldPath),
      masks: this.config.masks,
    });
  }

  getState(): BitState<T> {
    return getEffectiveStoreState(this.state, this.batchState);
  }

  getFieldState<P extends BitPath<T>>(
    path: P,
  ): BitFieldState<T, BitPathValue<T, P>> {
    const value = getDeepValue(
      this.state.values,
      path as string,
    ) as BitPathValue<T, P>;

    return createFieldStateSnapshot({
      state: this.state,
      path,
      value,
      isHidden: this.isHidden(path),
      isRequired: this.isRequired(path),
      isDirty: this.isFieldDirty(path as string),
      isValidating: this.isFieldValidating(path as string),
    });
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
    this.dependencyManager.register(path, config, this.state.values);
    this.registerCachedFieldIndexes(path, config);
    if (this.dependencyManager.isHidden(path)) {
      // Notify only the registered path instead of a full wildcard broadcast,
      // avoiding O(all-subscribers) re-evaluation on every conditional field mount.
      this.subscriptions.notify(this.state, [path]);
    }
  }

  unregisterField(path: string) {
    // Fields from initial config are never unregistered
    if (this.config.fields?.[path as string]) {
      return;
    }
    const config = this.getFieldConfig(path);
    this.validation.cleanupField(path as string);
    this.dependencyManager.unregister(path);
    this.unregisterCachedFieldIndexes(path, config);

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
      this.dispatch(
        patchStateOperation({
          errors: newErrors,
          touched: newTouched,
        }),
      );
    }
  }

  unregisterPrefix(prefix: string) {
    this.validation.cleanupPrefix(prefix);
    const removedEntries = this.dependencyManager.unregisterPrefix(prefix);

    removedEntries.forEach(([path, config]) => {
      this.unregisterCachedFieldIndexes(path, config);
    });
  }

  // ============================================================================
  // FIELD QUERIES (Delegated to query manager)
  // ============================================================================

  isHidden<P extends BitPath<T>>(path: P): boolean {
    return this.query.isHidden(path);
  }

  isRequired<P extends BitPath<T>>(path: P): boolean {
    return this.query.isRequired(path);
  }

  isFieldDirty(path: string): boolean {
    return this.query.isFieldDirty(path);
  }

  isFieldValidating(path: string): boolean {
    return this.query.isFieldValidating(path);
  }

  // ============================================================================
  // SUBSCRIPTIONS & WATCHERS
  // ============================================================================

  subscribe(listener: () => void): () => void {
    return this.subscriptions.subscribe(listener);
  }

  subscribeSelector<TSlice>(
    selector: BitSelector<T, TSlice>,
    listener: (slice: TSlice) => void,
    options?: BitSelectorSubscriptionOptions<TSlice>,
  ) {
    const equalityFn = options?.equalityFn ?? valueEqual;
    return this.subscriptions.subscribeSelector(
      selector,
      listener,
      options,
      equalityFn,
    );
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
    this.lifecycle.updateField(path, value, meta);
  }

  blurField<P extends BitPath<T>>(path: P) {
    this.internalSaveSnapshot();

    if (!this.state.touched[path as keyof typeof this.state.touched]) {
      this.batchStateUpdates(() => {
        this.dispatch(touchFieldsOperation([path as string]));
      });
    }

    this.validation.trigger([path]);
  }

  markFieldsTouched(paths: string[]) {
    if (paths.length === 0) return;
    this.dispatch(touchFieldsOperation(paths));
  }

  replaceValues(newValues: T) {
    this.lifecycle.replaceValues(newValues);
  }

  hydrate(values: DeepPartial<T>) {
    this.lifecycle.hydrateValues(values);
  }

  rebase(newValues: T) {
    this.lifecycle.rebaseValues(newValues);
  }

  // ============================================================================
  // ERROR MANAGEMENT (Delegated to errorMg)
  // ============================================================================

  setError(path: string, message: string | undefined) {
    this.error.setError(path, message);
  }

  setErrors(errors: BitErrors<T>) {
    this.error.setErrors(errors);
  }

  setServerErrors(serverErrors: Record<string, string[] | string>) {
    this.error.setServerErrors(serverErrors);
  }

  // ============================================================================
  // FORM-LEVEL OPERATIONS
  // ============================================================================

  reset() {
    this.lifecycle.reset();
  }

  transaction<TResult>(callback: () => TResult): TResult {
    return this.batchStateUpdates(callback);
  }

  async submit(
    onSuccess: (values: T, dirtyValues?: Partial<T>) => void | Promise<void>,
  ) {
    return this.lifecycle.submit(onSuccess);
  }

  registerMask(name: BitMaskName, mask: BitMask) {
    this.maskManager.registerMask(name, mask);
    this.config.masks = this.maskManager.getAllMasks();
    // Fire global listeners so useSyncExternalStore subscribers tracking
    // getMasksVersion() can pick up the change without broadcasting to all
    // path-scoped field subscribers (the sentinel path matches no real field).
    this.subscriptions.notify(this.state, ["__masks__"]);
  }

  unregisterMask(name: BitMaskName) {
    this.maskManager.unregisterMask(name);
    this.config.masks = this.maskManager.getAllMasks();
    // Notify subscribers of mask configuration change
    this.subscriptions.notify(this.state, ["__masks__"]);
  }

  getDirtyValues(): Partial<T> {
    return this.dirtyManager.buildDirtyValues(this.state.values);
  }

  getPersistMetadata(): BitPersistMetadata {
    return this.state.persist;
  }

  async restorePersisted(): Promise<boolean> {
    this.dispatch(persistMetaOperation({ isRestoring: true, error: null }));

    try {
      return await this.effects.restorePersisted();
    } catch (error) {
      this.dispatch(
        persistMetaOperation({
          isRestoring: false,
          error: error instanceof Error ? error : new Error(String(error)),
        }),
      );
      return false;
    } finally {
      this.dispatch(persistMetaOperation({ isRestoring: false }));
    }
  }

  async forceSave(): Promise<void> {
    this.dispatch(persistMetaOperation({ isSaving: true, error: null }));

    try {
      await this.effects.savePersistedNow();
    } catch (error) {
      this.dispatch(
        persistMetaOperation({
          isSaving: false,
          error: error instanceof Error ? error : new Error(String(error)),
        }),
      );
      return;
    }

    this.dispatch(persistMetaOperation({ isSaving: false }));
  }

  async clearPersisted(): Promise<void> {
    this.dispatch(persistMetaOperation({ error: null }));

    try {
      await this.effects.clearPersisted();
    } catch (error) {
      this.dispatch(
        persistMetaOperation({
          error: error instanceof Error ? error : new Error(String(error)),
        }),
      );
    }
  }

  // ============================================================================
  // ARRAY OPERATIONS (Delegated to arraysMg)
  // ============================================================================

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

  // ============================================================================
  // HISTORY & TIME-TRAVEL (Delegated to historyMg)
  // ============================================================================

  get canUndo(): boolean {
    return this.history.canUndo;
  }

  get canRedo(): boolean {
    return this.history.canRedo;
  }

  undo() {
    const prevState = this.history.undo();
    if (prevState) {
      const isDirty = this.dirtyManager.rebuild(prevState, this._initialValues);
      this.dispatch(historyApplyOperation(prevState, isDirty));
      this.validation.trigger(undefined, { forceDebounce: true });
    }
  }

  redo() {
    const nextState = this.history.redo();
    if (nextState) {
      const isDirty = this.dirtyManager.rebuild(nextState, this._initialValues);
      this.dispatch(historyApplyOperation(nextState, isDirty));
      this.validation.trigger(undefined, { forceDebounce: true });
    }
  }

  getHistoryMetadata(): BitHistoryMetadata {
    return this.history.getMetadata();
  }

  // ============================================================================
  // VALIDATION & SCOPES
  // ============================================================================

  validate(options?: BitValidationOptions): Promise<boolean> {
    return this.validation.validate(options);
  }

  emitBeforeValidate(event: BitBeforeValidateEvent<T>): Promise<void> {
    return this.effects.beforeValidate(event);
  }

  emitAfterValidate(event: BitAfterValidateEvent<T>): Promise<void> {
    return this.effects.afterValidate(event);
  }

  emitBeforeSubmit(event: BitBeforeSubmitEvent<T>): Promise<void> {
    return this.effects.beforeSubmit(event);
  }

  emitAfterSubmit(event: BitAfterSubmitEvent<T>): Promise<void> {
    return this.effects.afterSubmit(event);
  }

  emitFieldChange(event: BitFieldChangeEvent<T>) {
    this.effects.onFieldChange(event);
  }

  emitOperationalError(event: {
    source: "submit";
    error: unknown;
    payload?: unknown;
  }) {
    return this.effects.reportOperationalError(event);
  }

  hasValidationsInProgress(scopeFields?: string[]): boolean {
    return this.validation.hasValidationsInProgress(scopeFields);
  }

  triggerValidation(
    scopeFields?: string[],
    options?: BitValidationTriggerOptions,
  ) {
    this.validation.trigger(scopeFields, options);
  }

  getStepStatus(scopeName: string) {
    return this.scope.getStepStatus(scopeName);
  }

  getStepErrors(scopeName: string): Record<string, string> {
    return this.scope.getStepErrors(scopeName);
  }

  updateDependencies(changedPath: string, newValues: T): string[] {
    return this.dependencyManager.updateDependencies(changedPath, newValues);
  }

  isFieldHidden(path: string): boolean {
    return this.dependencyManager.isHidden(path);
  }

  evaluateAllDependencies(values: T): void {
    this.dependencyManager.evaluateAll(values);
  }

  getHiddenFields(): ReadonlySet<string> {
    return this.dependencyManager.getHiddenFields();
  }

  getRequiredErrors(values: T): BitErrors<T> {
    return this.dependencyManager.getRequiredErrors(values);
  }

  clearFieldValidation(path: string): void {
    this.validation.clear(path);
  }

  handleFieldAsyncValidation(path: string, value: any): void {
    this.validation.handleAsync(path, value);
  }

  cancelAllValidations(): void {
    this.validation.cancelAll();
  }

  validateNow(options?: BitValidationOptions): Promise<boolean> {
    return this.validation.validate(options);
  }

  updateDirtyForPath(path: string, nextValues: T, baselineValues: T): boolean {
    return this.dirtyManager.updateForPath(path, nextValues, baselineValues);
  }

  rebuildDirtyState(nextValues: T, baselineValues: T): boolean {
    return this.dirtyManager.rebuild(nextValues, baselineValues);
  }

  clearDirtyState(): void {
    this.dirtyManager.clear();
  }

  buildDirtyValues(values: T): Partial<T> {
    return this.dirtyManager.buildDirtyValues(values);
  }

  batchStateUpdates<TResult>(callback: () => TResult): TResult {
    beginStoreBatch(this.batchState);

    try {
      return callback();
    } finally {
      if (endStoreBatch(this.batchState)) {
        this.flushBatchedStateUpdates();
      }
    }
  }

  resetHistory(initialValues: T): void {
    this.history.reset(initialValues);
  }

  /** Current baseline used for dirty-state comparisons. */
  get initialValues(): T {
    return this._initialValues;
  }

  /** Returns the current baseline (usable as a port method). */
  getInitialValues(): T {
    return this._initialValues;
  }

  /**
   * Updates the baseline used for dirty comparisons.
   * Called by rebaseValues so that config is never mutated directly by managers.
   * Also syncs config.initialValues so getConfig() reflects the new baseline.
   */
  setInitialValues(values: T): void {
    this._initialValues = values;
    // Keep the public config reference consistent so that getConfig().initialValues
    // continues to return the current baseline after a rebase.
    this.config.initialValues = values;
  }

  /** Returns a monotonically increasing counter that increments every time a
   * mask is registered via registerMask(). Used by React components to track
   * mask configuration changes reactively without storing masks in BitState. */
  getMasksVersion(): number {
    return this.maskManager.getMasksVersion();
  }

  // ============================================================================
  // INTERNAL OPERATIONS
  // ============================================================================

  dispatch(operation: BitStoreOperation<T>) {
    const currentState = getEffectiveStoreState(this.state, this.batchState);

    if (this.batchState.depth > 0) {
      const updateResult = executeStoreOperation({
        currentState,
        operation,
        applyComputedValues: (values) => values,
      });

      if (!updateResult) {
        return;
      }

      trackBatchedStoreUpdate(this.batchState, updateResult);

      return;
    }

    const updateResult = executeStoreOperation({
      currentState: this.state,
      operation,
      applyComputedValues: (values, changedPaths) =>
        this.computedManager.apply(values, changedPaths),
    });

    if (!updateResult) {
      return;
    }

    this.state = updateResult.nextState;

    this.subscriptions.notify(this.state, updateResult.changedPaths);
    this.effects.onStateUpdated(this.state, updateResult.valuesChanged);
  }

  internalSaveSnapshot() {
    this.history.saveSnapshot(this.state.values);
  }

  private applyPersistedValues(values: Partial<T>) {
    const nextValues = deepClone({
      ...this._initialValues,
      ...values,
    } as T);

    this.validation.cancelAll();
    this.dependencyManager.evaluateAll(nextValues);

    const isDirty = this.dirtyManager.rebuild(nextValues, this._initialValues);

    this.dispatch(
      patchStateOperation({
        values: nextValues,
        errors: {},
        touched: {},
        isValidating: {},
        persist: { ...this.state.persist, error: null },
        isValid: true,
        isDirty,
        isSubmitting: false,
      }),
    );

    this.internalSaveSnapshot();
    this.validation.validate();
  }

  cleanup() {
    this.subscriptions.destroy();
    this.validation.cancelAll();
    this.capabilities.clear();
    this.effects.destroy();
  }

  private flushBatchedStateUpdates() {
    const flushResult = flushStoreBatchState({
      currentState: this.state,
      batchState: this.batchState,
      applyComputedValues: (values, changedPaths) =>
        this.computedManager.apply(values, changedPaths),
    });

    if (!flushResult) {
      return;
    }

    this.state = flushResult.nextState;
    this.subscriptions.notify(this.state, flushResult.changedPaths);
    this.effects.onStateUpdated(this.state, flushResult.valuesChanged);
  }
}
