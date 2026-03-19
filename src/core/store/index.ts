import { BitMask, BitMaskName } from "../mask/types";
import {
  BitConfig,
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
} from "./contracts/types";
import type {
  BitFormMeta,
  BitFrameworkConfig,
  BitHistoryMetadata,
  BitSelector,
  BitSelectorSubscriptionOptions,
  BitValidationOptions,
} from "./contracts/public-types";
import { deepClone, getDeepValue, valueEqual } from "../utils";
import { normalizeConfig } from "./shared/config";
import { BitFieldRegistry } from "./registry/field-registry";
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
  getEffectiveStoreState,
  type BitStoreBatchState,
} from "./engines/store-batch-engine";
import {
  createFieldStateSnapshot,
  resolveFieldMask,
} from "./engines/store-field-query-engine";
import { buildFieldUnregisterPatch } from "./engines/store-field-cleanup-engine";
import {
  dispatchStoreKernelOperation,
  flushStoreKernelBatch,
} from "./engines/store-commit-engine";
import {
  BitStoreOperation,
  historyApplyOperation,
  patchStateOperation,
  persistMetaOperation,
  touchFieldsOperation,
} from "./engines/operation-engine";
import { BitStoreEffectEngine } from "./engines/effect-engine";
import type { BitStoreCapabilities } from "./orchestration/capabilities";
import type { BitValidationTriggerOptions } from "./managers/features/validation-manager";
import {
  createInitialStoreState,
  createStoreCapabilities,
  createStoreEffects,
  type BitStoreCapabilityPorts,
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
 * - **Core**: BitFieldRegistry, BitComputedManager, BitDirtyManager
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
  private readonly maskManager: BitMaskManager;
  private readonly _validation: BitStoreCapabilities<T>["validation"];
  private readonly _lifecycle: BitStoreCapabilities<T>["lifecycle"];
  private readonly _history: BitStoreCapabilities<T>["history"];
  private readonly _arrays: BitStoreCapabilities<T>["arrays"];
  private readonly _scope: BitStoreCapabilities<T>["scope"];
  private readonly _query: BitStoreCapabilities<T>["query"];
  private readonly _error: BitStoreCapabilities<T>["error"];
  private readonly _config: BitFrameworkConfig<T>;
  /** Baseline for dirty tracking. Decoupled from config so that rebaseValues
   * can update it without mutating the user-provided config object. */
  private _initialValues!: T;

  // ============================================================================
  // PUBLIC PROPERTIES
  // ============================================================================

  public readonly storeId: string;
  get config(): Readonly<BitFrameworkConfig<T>> {
    return this._config;
  }

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  // Core Managers
  // Managers for essential form state management
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

  private readonly fieldRegistry: BitFieldRegistry<T>;
  private readonly computedManager: BitComputedManager<T>;
  private readonly dirtyManager: BitDirtyManager<T>;
  private readonly batchState: BitStoreBatchState<T> =
    createStoreBatchState<T>();

  private invalidateFieldIndexes() {
    this.fieldRegistry.invalidateIndexes();
    this.computedManager.invalidateReverseDeps();
  }

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  // Feature Managers
  // Managers for optional features like history, arrays, and scopes
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

  private get validation() {
    return this._validation;
  }

  private get lifecycle() {
    return this._lifecycle;
  }

  private get history() {
    return this._history;
  }

  private get arrays() {
    return this._arrays;
  }

  private get scope() {
    return this._scope;
  }

  private get query() {
    return this._query;
  }

  private get error() {
    return this._error;
  }

  // ============================================================================
  // CONSTRUCTOR
  // ============================================================================

  constructor(config: BitConfig<T> = {}) {
    this._config = normalizeConfig(config);
    this._initialValues = this._config.initialValues;

    // Initialize core managers
    this.fieldRegistry = new BitFieldRegistry<T>();
    this.computedManager = new BitComputedManager<T>(() =>
      this.getComputedEntries(),
    );
    this.dirtyManager = new BitDirtyManager<T>();
    this.maskManager = new BitMaskManager();
    if (this._config.masks) {
      Object.entries(this._config.masks).forEach(([name, mask]) => {
        this.maskManager.registerMask(name, mask);
      });
    }

    const capabilityPorts: BitStoreCapabilityPorts<T> = {
      config: this._config,
      validationPort: {
        getState: () => this.getState(),
        dispatch: (operation) => this.dispatch(operation),
        setError: (path, message) => this.setError(path, message),
        validate: (options) => this.validate(options),
        getFieldConfig: (path) => this.getFieldConfig(path),
        getScopeFields: (scopeName) => this.getScopeFields(scopeName),
        config: this._config,
        getRequiredErrors: (values) =>
          this.fieldRegistry.getRequiredErrors(values),
        getHiddenFields: () => this.fieldRegistry.getHiddenFields(),
        emitBeforeValidate: (event) => this.effects.beforeValidate(event),
        emitAfterValidate: (event) => this.effects.afterValidate(event),
      },
      lifecyclePort: {
        getState: () => this.getState(),
        dispatch: (operation) => this.dispatch(operation),
        internalSaveSnapshot: () => this.saveHistorySnapshot(),
        batchStateUpdates: (callback) => this.runStateBatch(callback),
        config: this._config,
        getTransformEntries: () => this.getTransformEntries(),
        updateDependencies: (changedPath, newValues) =>
          this.fieldRegistry.updateDependencies(changedPath, newValues),
        isFieldHidden: (path) => this.fieldRegistry.isHidden(path),
        evaluateAllDependencies: (values) =>
          this.fieldRegistry.evaluateAll(values),
        getHiddenFields: () => this.fieldRegistry.getHiddenFields(),
        clearFieldValidation: (path) => this.validation.clear(path),
        triggerValidation: (scopeFields, options) =>
          this.validation.trigger(scopeFields, options),
        handleFieldAsyncValidation: (path, value) =>
          this.validation.handleAsync(path, value),
        cancelAllValidations: () => this.validation.cancelAll(),
        validateNow: (options) => this.validation.validate(options),
        hasValidationsInProgress: (scopeFields) =>
          this.validation.hasValidationsInProgress(scopeFields),
        updateDirtyForPath: (path, nextValues, baselineValues) =>
          this.dirtyManager.updateForPath(path, nextValues, baselineValues),
        rebuildDirtyState: (nextValues, baselineValues) =>
          this.dirtyManager.rebuild(nextValues, baselineValues),
        clearDirtyState: () => this.dirtyManager.clear(),
        buildDirtyValues: (values) =>
          this.dirtyManager.buildDirtyValues(values),
        getInitialValues: () => this._initialValues,
        setInitialValues: (values) => {
          this._initialValues = values;
        },
        resetHistory: (initialValues) => this.history.reset(initialValues),
        emitFieldChange: (event) => this.effects.onFieldChange(event),
        emitBeforeSubmit: (event) => this.effects.beforeSubmit(event),
        emitAfterSubmit: (event) => this.effects.afterSubmit(event),
        emitOperationalError: (event) =>
          this.effects.reportOperationalError(event),
      },
      arrayPort: {
        getState: () => this.getState(),
        setFieldWithMeta: (path, value, meta) =>
          this.setFieldWithMeta(path, value, meta),
        emitFieldChange: (event) => this.effects.onFieldChange(event),
        dispatch: (operation) => this.dispatch(operation),
        internalSaveSnapshot: () => this.saveHistorySnapshot(),
        unregisterPrefix: (prefix) => this.unregisterPrefix(prefix),
        triggerValidation: (scopeFields) => this.triggerValidation(scopeFields),
        updateDirtyForPath: (path, nextValues, baselineValues) =>
          this.dirtyManager.updateForPath(path, nextValues, baselineValues),
        getConfig: () => this.getConfig(),
      },
      getScopeFields: (scopeName) => this.getScopeFields(scopeName),
      getState: () => this.getState(),
      dispatch: (operation) => this.dispatch(operation),
      getInitialValues: () => this._initialValues,
      isPathDirty: (path) => this.dirtyManager.isPathDirty(path),
    };

    const capabilities = createStoreCapabilities<T>({
      ports: capabilityPorts,
      fieldRegistry: this.fieldRegistry,
    });
    this._validation = capabilities.validation;
    this._lifecycle = capabilities.lifecycle;
    this._history = capabilities.history;
    this._arrays = capabilities.arrays;
    this._scope = capabilities.scope;
    this._query = capabilities.query;
    this._error = capabilities.error;

    this.state = createInitialStoreState<T>({
      config: this._config,
      fieldRegistry: this.fieldRegistry,
      computedManager: this.computedManager,
    });
    this.subscriptions = new BitSubscriptionEngine<T>(() => this.state);

    this.saveHistorySnapshot();

    this.storeId =
      config.storeId ||
      this._config.name ||
      this._config.idFactory({
        scope: "store",
        storeName: this._config.name,
      });

    this.effects = createStoreEffects<T>({
      storeId: this.storeId,
      storeInstance: this,
      config: this._config,
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
    return this._config;
  }

  getFieldConfig(path: string): BitFieldDefinition<T> | undefined {
    return this.fieldRegistry.getFieldConfig(path);
  }

  getScopeFields(scopeName: string): string[] {
    return this.fieldRegistry.getScopeFields(scopeName);
  }

  private getComputedEntries(): BitComputedEntry<T>[] {
    return this.fieldRegistry.getComputedEntries();
  }

  private getTransformEntries(): [string, BitTransformFn<T>][] {
    return this.fieldRegistry.getTransformEntries();
  }

  resolveMask(path: string): BitMask | undefined {
    return resolveFieldMask({
      path,
      getFieldConfig: (fieldPath) => this.getFieldConfig(fieldPath),
      masks: this.maskManager.getAllMasks(),
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
    this.fieldRegistry.register(path, config, this.state.values);
    if (this.fieldRegistry.isHidden(path)) {
      // Notify only the registered path instead of a full wildcard broadcast,
      // avoiding O(all-subscribers) re-evaluation on every conditional field mount.
      this.subscriptions.notify(this.state, [path]);
    }
  }

  unregisterField(path: string) {
    // Fields from initial config are never unregistered
    if (this._config.fields?.[path as string]) {
      return;
    }
    this.validation.cleanupField(path as string);
    this.fieldRegistry.unregister(path);
    this.invalidateFieldIndexes();

    const cleanupPatch = buildFieldUnregisterPatch({
      state: this.state,
      path,
    });

    if (cleanupPatch) {
      this.dispatch(
        patchStateOperation({
          errors: cleanupPatch.errors,
          touched: cleanupPatch.touched,
        }),
      );
    }
  }

  unregisterPrefix(prefix: string) {
    this.validation.cleanupPrefix(prefix);
    this.fieldRegistry.unregisterPrefix(prefix);
    this.invalidateFieldIndexes();
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

  /**
   * Subscribes to the full reactive state snapshot of a single field.
   * More efficient than the raw `subscribeSelector` pattern because it
   * pre-configures path scoping and a structural equality check covering
   * all field-state properties (value, error, touched, dirty, hidden, …).
   * This is the recommended API for framework field bindings.
   */
  subscribeFieldState<P extends BitPath<T>>(
    path: P,
    listener: (state: Readonly<BitFieldState<T, BitPathValue<T, P>>>) => void,
  ): () => void {
    return this.subscribeSelector(
      () =>
        this.getFieldState(path) as Readonly<
          BitFieldState<T, BitPathValue<T, P>>
        >,
      listener,
      {
        paths: [path as string],
        equalityFn: (prev, next) =>
          prev.value === next.value &&
          prev.error === next.error &&
          prev.touched === next.touched &&
          prev.isHidden === next.isHidden &&
          prev.isRequired === next.isRequired &&
          prev.isDirty === next.isDirty &&
          prev.isValidating === next.isValidating,
      },
    );
  }

  /**
   * Subscribes to form-level metadata (isValid, isDirty, isSubmitting).
   * Replaces the `subscribeSelector` + manual path list pattern used internally
   * by framework form hooks. The listener is called only when one of the three
   * flags actually changes.
   */
  subscribeFormMeta(listener: (meta: BitFormMeta) => void): () => void {
    return this.subscribeSelector(
      (state) => ({
        isValid: state.isValid,
        isDirty: state.isDirty,
        isSubmitting: state.isSubmitting,
      }),
      listener,
      {
        paths: ["isValid", "isDirty", "isSubmitting"],
        equalityFn: (prev, next) =>
          prev.isValid === next.isValid &&
          prev.isDirty === next.isDirty &&
          prev.isSubmitting === next.isSubmitting,
      },
    );
  }

  // ============================================================================
  // FIELD VALUE MUTATIONS
  // ============================================================================

  setField<P extends BitPath<T>>(path: P, value: BitPathValue<T, P>) {
    this.setFieldWithMeta(path as string, value, { origin: "setField" });
  }

  private setFieldWithMeta(
    path: string,
    value: any,
    meta: BitFieldChangeMeta = { origin: "setField" },
  ) {
    this.lifecycle.updateField(path, value, meta);
  }

  blurField<P extends BitPath<T>>(path: P) {
    this.saveHistorySnapshot();

    if (!this.state.touched[path as keyof typeof this.state.touched]) {
      this.runStateBatch(() => {
        this.dispatch(touchFieldsOperation([path as string]));
      });
    }

    this.validation.trigger([path]);
  }

  markFieldsTouched(paths: string[]) {
    if (paths.length === 0) return;
    this.dispatch(touchFieldsOperation(paths));
  }

  setValues(
    values: T | DeepPartial<T>,
    options?: { partial?: boolean; rebase?: boolean },
  ) {
    this.lifecycle.setValues(values, options);
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
    return this.runStateBatch(callback);
  }

  async submit(
    onSuccess: (values: T, dirtyValues?: Partial<T>) => void | Promise<void>,
  ) {
    return this.lifecycle.submit(onSuccess);
  }

  registerMask(name: BitMaskName, mask: BitMask) {
    this.maskManager.registerMask(name, mask);
    this._config.masks = this.maskManager.getAllMasks();
    this.subscriptions.notify(this.state, ["__masks__"]);
  }

  unregisterMask(name: BitMaskName) {
    this.maskManager.unregisterMask(name);
    this._config.masks = this.maskManager.getAllMasks();
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

  private runStateBatch<TResult>(callback: () => TResult): TResult {
    beginStoreBatch(this.batchState);

    try {
      return callback();
    } finally {
      if (endStoreBatch(this.batchState)) {
        this.flushBatchedStateUpdates();
      }
    }
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

  private dispatch(operation: BitStoreOperation<T>) {
    this.state = dispatchStoreKernelOperation({
      state: this.state,
      batchState: this.batchState,
      operation,
      applyComputedValues: (values, changedPaths) =>
        this.computedManager.apply(values, changedPaths),
      onStateCommitted: ({ nextState, changedPaths, valuesChanged }) => {
        this.state = nextState;
        this.subscriptions.notify(this.state, changedPaths);
        this.effects.onStateUpdated(this.state, valuesChanged);
      },
    });
  }

  private saveHistorySnapshot() {
    // If we're inside a transaction, defer the snapshot to flush time
    // so that multiple mutations (e.g. several array ops in a transaction)
    // produce a single history entry rather than one per mutation.
    if (this.batchState.depth > 0) {
      this.batchState.pendingHistorySnapshot = true;
      return;
    }
    this.history.saveSnapshot(this.state.values);
  }

  private applyPersistedValues(values: Partial<T>) {
    const nextValues = deepClone({
      ...this._initialValues,
      ...values,
    } as T);

    this.validation.cancelAll();
    this.fieldRegistry.evaluateAll(nextValues);

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

    this.saveHistorySnapshot();
    this.validation.validate();
  }

  cleanup() {
    this.subscriptions.destroy();
    this.validation.cancelAll();
    this.effects.destroy();
  }

  private flushBatchedStateUpdates() {
    this.state = flushStoreKernelBatch({
      state: this.state,
      batchState: this.batchState,
      applyComputedValues: (values, changedPaths) =>
        this.computedManager.apply(values, changedPaths),
      onStateCommitted: ({ nextState, changedPaths, valuesChanged }) => {
        this.state = nextState;
        this.subscriptions.notify(this.state, changedPaths);
        this.effects.onStateUpdated(this.state, valuesChanged);
      },
    });

    // Flush any deferred history snapshot produced during the batch.
    if (this.batchState.pendingHistorySnapshot) {
      this.batchState.pendingHistorySnapshot = false;
      this.history.saveSnapshot(this.state.values);
    }
  }
}
