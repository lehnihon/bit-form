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
import { BitSubscriptionEngine } from "./engines/subscription-engine";
import { applyStateUpdate } from "./engines/state-update-engine";
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
 */
export class BitStore<T extends object = any> {
  // ============================================================================
  // PRIVATE PROPERTIES
  // ============================================================================

  private state: BitState<T>;
  private readonly subscriptions: BitSubscriptionEngine<T>;
  private readonly effects: BitStoreEffectEngine<T>;
  private readonly capabilities: BitCapabilityRegistry<BitStoreCapabilities<T>>;

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
  private scopeFieldsIndex: Map<string, string[]> | null = null;
  private computedEntriesCache: BitComputedEntry<T>[] | null = null;
  private transformEntriesCache: [string, BitTransformFn<T>][] | null = null;
  private batchDepth = 0;
  private batchedPartialState: Partial<BitState<T>> | null = null;
  private batchedChangedPaths: Set<string> | null = null;

  private invalidateFieldIndexes() {
    this.scopeFieldsIndex = null;
    this.computedEntriesCache = null;
    this.transformEntriesCache = null;
  }

  private registerCachedFieldIndexes(
    path: string,
    config: BitFieldDefinition<T>,
  ) {
    if (this.scopeFieldsIndex && config.scope) {
      const scopedPaths = this.scopeFieldsIndex.get(config.scope) ?? [];
      if (!scopedPaths.includes(path)) {
        scopedPaths.push(path);
        this.scopeFieldsIndex.set(config.scope, scopedPaths);
      }
    }

    if (this.computedEntriesCache && config.computed) {
      this.computedEntriesCache.push({
        path,
        compute: config.computed,
        dependsOn: config.computedDependsOn ?? config.conditional?.dependsOn,
      });
    }

    if (this.transformEntriesCache && config.transform) {
      this.transformEntriesCache.push([path, config.transform]);
    }
  }

  private unregisterCachedFieldIndexes(
    path: string,
    config?: BitFieldDefinition<T>,
  ) {
    if (!config) {
      this.invalidateFieldIndexes();
      return;
    }

    if (this.scopeFieldsIndex && config.scope) {
      const scopedPaths = this.scopeFieldsIndex.get(config.scope);
      if (scopedPaths) {
        const nextPaths = scopedPaths.filter((fieldPath) => fieldPath !== path);
        if (nextPaths.length > 0) {
          this.scopeFieldsIndex.set(config.scope, nextPaths);
        } else {
          this.scopeFieldsIndex.delete(config.scope);
        }
      }
    }

    if (this.computedEntriesCache && config.computed) {
      this.computedEntriesCache = this.computedEntriesCache.filter(
        (entry) => entry.path !== path,
      );
    }

    if (this.transformEntriesCache && config.transform) {
      this.transformEntriesCache = this.transformEntriesCache.filter(
        ([entryPath]) => entryPath !== path,
      );
    }
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

    // Initialize core managers
    this.dependencyManager = new BitDependencyManager<T>();
    this.computedManager = new BitComputedManager<T>(() =>
      this.getComputedEntries(),
    );
    this.dirtyManager = new BitDirtyManager<T>();
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
    if (!this.scopeFieldsIndex) {
      const index = new Map<string, string[]>();
      this.dependencyManager.forEachFieldConfig((cfg, path) => {
        if (!cfg.scope) {
          return;
        }
        const list = index.get(cfg.scope) ?? [];
        list.push(path);
        index.set(cfg.scope, list);
      });
      this.scopeFieldsIndex = index;
    }

    return this.scopeFieldsIndex.get(scopeName) ?? [];
  }

  getComputedEntries(): BitComputedEntry<T>[] {
    if (!this.computedEntriesCache) {
      const result: BitComputedEntry<T>[] = [];
      this.dependencyManager.forEachFieldConfig((cfg, path) => {
        if (cfg.computed) {
          result.push({
            path,
            compute: cfg.computed,
            dependsOn: cfg.computedDependsOn ?? cfg.conditional?.dependsOn,
          });
        }
      });
      this.computedEntriesCache = result;
    }

    return this.computedEntriesCache;
  }

  getTransformEntries(): [string, BitTransformFn<T>][] {
    if (!this.transformEntriesCache) {
      const result: [string, BitTransformFn<T>][] = [];
      this.dependencyManager.forEachFieldConfig((cfg, path) => {
        if (cfg.transform) {
          result.push([path, cfg.transform]);
        }
      });
      this.transformEntriesCache = result;
    }

    return this.transformEntriesCache;
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
    this.dependencyManager.register(path, config, this.state.values);
    this.registerCachedFieldIndexes(path, config);
    if (this.dependencyManager.isHidden(path)) {
      this.subscriptions.notify(this.state, ["*"]);
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
      this.internalUpdateState({
        errors: newErrors,
        touched: newTouched,
      });
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
        this.internalUpdateState({
          touched: { ...this.state.touched, [path]: true },
        });
      });
    }

    this.validation.trigger([path]);
  }

  markFieldsTouched(paths: string[]) {
    if (paths.length === 0) return;
    const newTouched = { ...this.state.touched };
    paths.forEach((path) => {
      newTouched[path as keyof typeof newTouched] = true;
    });
    this.internalUpdateState({ touched: newTouched });
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

  async submit(
    onSuccess: (values: T, dirtyValues?: Partial<T>) => void | Promise<void>,
  ) {
    return this.lifecycle.submit(onSuccess);
  }

  registerMask(name: BitMaskName, mask: BitMask) {
    this.config.masks = {
      ...(this.config.masks || {}),
      [name]: mask,
    };
  }

  getDirtyValues(): Partial<T> {
    return this.dirtyManager.buildDirtyValues(this.state.values);
  }

  getPersistMetadata(): BitPersistMetadata {
    return this.state.persist;
  }

  async restorePersisted(): Promise<boolean> {
    this.internalUpdateState({
      persist: { ...this.state.persist, isRestoring: true, error: null },
    });

    try {
      return await this.effects.restorePersisted();
    } catch (error) {
      this.internalUpdateState({
        persist: {
          ...this.state.persist,
          isRestoring: false,
          error: error instanceof Error ? error : new Error(String(error)),
        },
      });
      return false;
    } finally {
      this.internalUpdateState({
        persist: { ...this.state.persist, isRestoring: false },
      });
    }
  }

  async forceSave(): Promise<void> {
    this.internalUpdateState({
      persist: { ...this.state.persist, isSaving: true, error: null },
    });

    try {
      await this.effects.savePersistedNow();
    } catch (error) {
      this.internalUpdateState({
        persist: {
          ...this.state.persist,
          isSaving: false,
          error: error instanceof Error ? error : new Error(String(error)),
        },
      });
      return;
    }

    this.internalUpdateState({
      persist: { ...this.state.persist, isSaving: false },
    });
  }

  async clearPersisted(): Promise<void> {
    this.internalUpdateState({
      persist: { ...this.state.persist, error: null },
    });

    try {
      await this.effects.clearPersisted();
    } catch (error) {
      this.internalUpdateState({
        persist: {
          ...this.state.persist,
          error: error instanceof Error ? error : new Error(String(error)),
        },
      });
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
      const isDirty = this.dirtyManager.rebuild(
        prevState,
        this.config.initialValues,
      );
      this.internalUpdateState({ values: prevState, isDirty });
      this.validation.trigger(undefined, { forceDebounce: true });
    }
  }

  redo() {
    const nextState = this.history.redo();
    if (nextState) {
      const isDirty = this.dirtyManager.rebuild(
        nextState,
        this.config.initialValues,
      );
      this.internalUpdateState({ values: nextState, isDirty });
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
    this.batchDepth += 1;

    try {
      return callback();
    } finally {
      this.batchDepth -= 1;

      if (this.batchDepth === 0) {
        this.flushBatchedStateUpdates();
      }
    }
  }

  resetHistory(initialValues: T): void {
    this.history.reset(initialValues);
  }

  // ============================================================================
  // INTERNAL OPERATIONS
  // ============================================================================

  internalUpdateState(
    partialState: Partial<BitState<T>>,
    changedPaths?: string[],
  ) {
    if (this.batchDepth > 0) {
      this.batchedPartialState = {
        ...(this.batchedPartialState ?? {}),
        ...partialState,
      };

      if (changedPaths && changedPaths.length > 0) {
        const pathSet = this.batchedChangedPaths ?? new Set<string>();
        changedPaths.forEach((path) => pathSet.add(path));
        this.batchedChangedPaths = pathSet;
      }

      return;
    }

    const updateResult = applyStateUpdate({
      currentState: this.state,
      partialState,
      changedPaths,
      applyComputedValues: (values) =>
        this.computedManager.apply(values, changedPaths),
    });

    this.state = updateResult.nextState;

    this.subscriptions.notify(this.state, updateResult.changedPaths);
    this.effects.onStateUpdated(this.state, updateResult.valuesChanged);
  }

  internalSaveSnapshot() {
    this.history.saveSnapshot(this.state.values);
  }

  private applyPersistedValues(values: Partial<T>) {
    const nextValues = deepClone({
      ...this.config.initialValues,
      ...values,
    } as T);

    this.validation.cancelAll();
    this.dependencyManager.evaluateAll(nextValues);

    const isDirty = this.dirtyManager.rebuild(
      nextValues,
      this.config.initialValues,
    );

    this.internalUpdateState({
      values: nextValues,
      errors: {},
      touched: {},
      isValidating: {},
      persist: { ...this.state.persist, error: null },
      isValid: true,
      isDirty,
      isSubmitting: false,
    });

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
    if (!this.batchedPartialState) {
      return;
    }

    const partialState = this.batchedPartialState;
    const changedPaths = this.batchedChangedPaths
      ? Array.from(this.batchedChangedPaths)
      : undefined;

    this.batchedPartialState = null;
    this.batchedChangedPaths = null;

    this.internalUpdateState(partialState, changedPaths);
  }
}
