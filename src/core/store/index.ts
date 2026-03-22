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
import { getDeepValue, valueEqual } from "../utils";
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
import {
  dispatchStoreKernelOperation,
  flushStoreKernelBatch,
} from "./engines/store-commit-engine";
import {
  BitStoreOperation,
  patchStateOperation,
  touchFieldsOperation,
} from "./engines/operation-engine";
import { BitStoreEffectEngine } from "./engines/effect-engine";
import type { BitStoreCapabilities } from "./orchestration/capabilities";
import type { BitValidationTriggerOptions } from "./contracts/port-types";
import { createStoreEffects } from "./orchestration/store-bootstrap";
import { BIT_HOOKS_API_SYMBOL } from "./orchestration/hook-brand";
import { createTrackedSubscription } from "./orchestration/tracked-selector";
import { createStoreRuntime } from "./orchestration/store-runtime";
import {
  registerStoreField,
  unregisterStoreField,
  unregisterStorePrefix,
} from "./orchestration/store-registration-ops";
import {
  applyStorePersistedValues,
  clearStorePersisted,
  forceStorePersistedSave,
  restoreStorePersisted,
} from "./orchestration/store-persist-ops";
export class BitStore<T extends object = any> {
  public readonly [BIT_HOOKS_API_SYMBOL] = true;

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
  private _cachedConfig: BitFrameworkConfig<T>;
  private _initialValues!: T;

  public readonly storeId: string;
  get config(): Readonly<BitFrameworkConfig<T>> {
    return this._cachedConfig ?? this._config;
  }

  private readonly fieldRegistry: BitFieldRegistry<T>;
  private readonly computedManager: BitComputedManager<T>;
  private readonly dirtyManager: BitDirtyManager<T>;
  private readonly batchState: BitStoreBatchState<T> =
    createStoreBatchState<T>();

  private invalidateFieldIndexes() {
    this.fieldRegistry.invalidateIndexes();
    this.computedManager.invalidateReverseDeps();
  }

  constructor(config: BitConfig<T> = {}) {
    this._config = normalizeConfig(config);
    this._initialValues = this._config.initialValues;
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

    const runtime = createStoreRuntime<T>({
      rawConfig: config,
      config: this._config,
      fieldRegistry: this.fieldRegistry,
      computedManager: this.computedManager,
      dirtyManager: this.dirtyManager,
      initialValuesRef: {
        get: () => this._initialValues,
        set: (values) => {
          this._initialValues = values;
        },
      },
      storeInstance: this,
      getState: () => this.getState(),
      dispatch: (operation) => this.dispatch(operation),
      setError: (path, message) => this.setError(path, message),
      validate: (options) => this.validate(options),
      getFieldConfig: (path) => this.getFieldConfig(path),
      getScopeFields: (scopeName) => this.getScopeFields(scopeName),
      getEffects: () => this.effects,
      saveHistorySnapshot: () => this.saveHistorySnapshot(),
      runStateBatch: (callback) => this.runStateBatch(callback),
      getTransformEntries: () => this.getTransformEntries(),
      getHistory: () => this._history,
      getValidation: () => this._validation,
      setFieldWithMeta: (path, value, meta) =>
        this.setFieldWithMeta(path, value, meta),
      unregisterPrefix: (prefix) => this.unregisterPrefix(prefix),
      triggerValidation: (scopeFields, options) =>
        this.triggerValidation(scopeFields, options),
      getConfig: () => this.getConfig(),
      getDirtyValues: () => this.getDirtyValues(),
      applyPersistedValues: (values) => this.applyPersistedValues(values),
    });

    this._validation = runtime.capabilities.validation;
    this._lifecycle = runtime.capabilities.lifecycle;
    this._history = runtime.capabilities.history;
    this._arrays = runtime.capabilities.arrays;
    this._scope = runtime.capabilities.scope;
    this._query = runtime.capabilities.query;
    this._error = runtime.capabilities.error;
    this.state = runtime.state;
    this.subscriptions = runtime.subscriptions;
    this.storeId = runtime.storeId;
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

    this.saveHistorySnapshot();

    this._cachedConfig = this._config;
  }

  getConfig() {
    return this._cachedConfig ?? this._config;
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
    const effectiveState = this.getState();
    const value = getDeepValue(
      effectiveState.values,
      path as string,
    ) as BitPathValue<T, P>;

    return createFieldStateSnapshot({
      state: effectiveState,
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

  registerField(path: string, config: BitFieldDefinition<T>) {
    registerStoreField({
      path,
      config,
      state: this.state,
      fieldRegistry: this.fieldRegistry,
      subscriptions: this.subscriptions,
      invalidateFieldIndexes: () => this.invalidateFieldIndexes(),
    });
  }

  unregisterField(path: string) {
    unregisterStoreField({
      path,
      state: this.state,
      hasStaticConfig: !!this._config.fields?.[path as string],
      fieldRegistry: this.fieldRegistry,
      validationCleanupField: (fieldPath) =>
        this._validation.cleanupField(fieldPath),
      invalidateFieldIndexes: () => this.invalidateFieldIndexes(),
      dispatch: (operation) => this.dispatch(operation),
    });
  }

  unregisterPrefix(prefix: string) {
    unregisterStorePrefix({
      prefix,
      fieldRegistry: this.fieldRegistry,
      validationCleanupPrefix: (fieldPrefix) =>
        this._validation.cleanupPrefix(fieldPrefix),
      invalidateFieldIndexes: () => this.invalidateFieldIndexes(),
    });
  }

  isHidden<P extends BitPath<T>>(path: P): boolean {
    return this._query.isHidden(path);
  }

  isRequired<P extends BitPath<T>>(path: P): boolean {
    return this._query.isRequired(path);
  }

  isFieldDirty(path: string): boolean {
    return this._query.isFieldDirty(path);
  }

  isFieldValidating(path: string): boolean {
    return this._query.isFieldValidating(path);
  }

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

  subscribeTracked<TSlice>(
    selector: BitSelector<T, TSlice>,
    listener: (slice: TSlice) => void,
    options?: Omit<BitSelectorSubscriptionOptions<TSlice>, "paths">,
  ) {
    return createTrackedSubscription({
      getState: () => this.getState(),
      subscribeSelector: (trackedSelector, trackedListener, trackedOptions) =>
        this.subscribeSelector(
          trackedSelector,
          trackedListener,
          trackedOptions,
        ),
      selector,
      listener,
      options,
    });
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

  setField<P extends BitPath<T>>(path: P, value: BitPathValue<T, P>) {
    this.setFieldWithMeta(path as string, value, { origin: "setField" });
  }

  private setFieldWithMeta(
    path: string,
    value: any,
    meta: BitFieldChangeMeta = { origin: "setField" },
  ) {
    this._lifecycle.updateField(path, value, meta);
  }

  blurField<P extends BitPath<T>>(path: P) {
    this.saveHistorySnapshot();

    if (!this._query.isTouched(path as string)) {
      this.runStateBatch(() => {
        this.dispatch(touchFieldsOperation([path as string]));
      });
    }

    this._validation.trigger([path]);
  }

  markFieldsTouched(paths: string[]) {
    if (paths.length === 0) return;
    this.dispatch(touchFieldsOperation(paths));
  }

  setValues(
    values: T | DeepPartial<T>,
    options?: { partial?: boolean; rebase?: boolean },
  ) {
    this._lifecycle.setValues(values, options);
  }

  setError(path: string, message: string | undefined) {
    this._error.setError(path, message);
  }

  setErrors(errors: BitErrors<T>) {
    this._error.setErrors(errors);
  }

  setServerErrors(serverErrors: Record<string, string[] | string>) {
    this._error.setServerErrors(serverErrors);
  }

  reset() {
    this._lifecycle.reset();
  }

  transaction<TResult>(callback: () => TResult): TResult {
    return this.runStateBatch(callback);
  }

  async submit(
    onSuccess: (values: T, dirtyValues?: Partial<T>) => void | Promise<void>,
  ) {
    return this._lifecycle.submit(onSuccess);
  }

  registerMask(name: BitMaskName, mask: BitMask) {
    this.maskManager.registerMask(name, mask);
    this._cachedConfig = {
      ...this._config,
      masks: this.maskManager.getAllMasks(),
    };
    this.subscriptions.notify(this.state, ["__masks__"]);
  }

  unregisterMask(name: BitMaskName) {
    this.maskManager.unregisterMask(name);
    this._cachedConfig = {
      ...this._config,
      masks: this.maskManager.getAllMasks(),
    };
    this.subscriptions.notify(this.state, ["__masks__"]);
  }

  getDirtyValues(): Partial<T> {
    return this.dirtyManager.buildDirtyValues(this.state.values);
  }

  getPersistMetadata(): BitPersistMetadata {
    return this.state.persist;
  }

  async restorePersisted(): Promise<boolean> {
    return restoreStorePersisted({
      dispatch: (operation) => this.dispatch(operation),
      effects: this.effects,
    });
  }

  async forceSave(): Promise<void> {
    return forceStorePersistedSave({
      dispatch: (operation) => this.dispatch(operation),
      effects: this.effects,
    });
  }

  async clearPersisted(): Promise<void> {
    return clearStorePersisted({
      dispatch: (operation) => this.dispatch(operation),
      effects: this.effects,
    });
  }

  pushItem<P extends BitArrayPath<T>>(
    path: P,
    value: BitArrayItem<BitPathValue<T, P>>,
  ) {
    this._arrays.pushItem(path, value);
  }

  prependItem<P extends BitArrayPath<T>>(
    path: P,
    value: BitArrayItem<BitPathValue<T, P>>,
  ) {
    this._arrays.prependItem(path, value);
  }

  insertItem<P extends BitArrayPath<T>>(
    path: P,
    index: number,
    value: BitArrayItem<BitPathValue<T, P>>,
  ) {
    this._arrays.insertItem(path, index, value);
  }

  removeItem<P extends BitArrayPath<T>>(path: P, index: number) {
    this._arrays.removeItem(path, index);
  }

  swapItems<P extends BitArrayPath<T>>(
    path: P,
    indexA: number,
    indexB: number,
  ) {
    this._arrays.swapItems(path, indexA, indexB);
  }

  moveItem<P extends BitArrayPath<T>>(path: P, from: number, to: number) {
    this._arrays.moveItem(path, from, to);
  }

  get canUndo(): boolean {
    return this._history.canUndo;
  }

  get canRedo(): boolean {
    return this._history.canRedo;
  }

  undo() {
    const prevState = this._history.undo();
    if (prevState) {
      this._lifecycle.applyHistoryState(prevState);
    }
  }

  redo() {
    const nextState = this._history.redo();
    if (nextState) {
      this._lifecycle.applyHistoryState(nextState);
    }
  }

  getHistoryMetadata(): BitHistoryMetadata {
    return this._history.getMetadata();
  }

  validate(options?: BitValidationOptions): Promise<boolean> {
    return this._validation.validate(options);
  }

  hasValidationsInProgress(scopeFields?: string[]): boolean {
    return this._validation.hasValidationsInProgress(scopeFields);
  }

  triggerValidation(
    scopeFields?: string[],
    options?: BitValidationTriggerOptions,
  ) {
    this._validation.trigger(scopeFields, options);
  }

  getStepStatus(scopeName: string) {
    return this._scope.getStepStatus(scopeName);
  }

  getStepErrors(scopeName: string): Record<string, string> {
    return this._scope.getStepErrors(scopeName);
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

  getMasksVersion(): number {
    return this.maskManager.getMasksVersion();
  }

  private onStateCommitted(payload: {
    nextState: BitState<T>;
    changedPaths?: Iterable<string>;
    valuesChanged: boolean;
  }): void {
    this.state = payload.nextState;
    this.subscriptions.notify(this.state, payload.changedPaths);
    this.effects.onStateUpdated(this.state, payload.valuesChanged);
  }

  private dispatch(operation: BitStoreOperation<T>) {
    this.state = dispatchStoreKernelOperation({
      state: this.state,
      batchState: this.batchState,
      operation,
      applyComputedValues: (values, changedPaths) =>
        this.computedManager.apply(values, changedPaths),
      onStateCommitted: (payload) => this.onStateCommitted(payload),
    });
  }

  private saveHistorySnapshot() {
    if (this.batchState.depth > 0) {
      this.batchState.pendingHistorySnapshot = true;
      return;
    }
    this._history.saveSnapshot(this.state.values);
  }

  private applyPersistedValues(values: Partial<T>) {
    applyStorePersistedValues({
      values,
      state: this.state,
      initialValues: this._initialValues,
      validation: this._validation,
      fieldRegistry: this.fieldRegistry,
      dirtyManager: this.dirtyManager,
      dispatch: (operation) => this.dispatch(operation),
      saveHistorySnapshot: () => this.saveHistorySnapshot(),
    });
  }

  cleanup() {
    this.subscriptions.destroy();
    this._validation.cancelAll();
    this.effects.destroy();
  }

  private flushBatchedStateUpdates() {
    this.state = flushStoreKernelBatch({
      state: this.state,
      batchState: this.batchState,
      applyComputedValues: (values, changedPaths) =>
        this.computedManager.apply(values, changedPaths),
      onStateCommitted: (payload) => this.onStateCommitted(payload),
    });

    if (this.batchState.pendingHistorySnapshot) {
      this.batchState.pendingHistorySnapshot = false;
      this._history.saveSnapshot(this.state.values);
    }
  }
}
