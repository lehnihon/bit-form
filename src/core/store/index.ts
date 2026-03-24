import { BitMask, BitMaskName } from "../mask/types";
import { getDeepValue } from "../utils";
import {
  BitArrayItem,
  BitArrayPath,
  BitConfig,
  BitErrors,
  BitFieldChangeMeta,
  BitFieldDefinition,
  BitFieldState,
  BitPath,
  BitPathValue,
  BitPersistMetadata,
  BitSubmitResult,
  BitState,
  DeepPartial,
  ScopeStatus,
} from "./contracts/types";
import type {
  BitFormMeta,
  BitFrameworkConfig,
  BitHistoryMetadata,
  BitSelector,
  BitSelectorSubscriptionOptions,
  BitValidationOptions,
} from "./contracts/public-types";
import type { BitValidationTriggerOptions } from "./contracts/port-types";
import {
  createFieldStateSnapshot,
  resolveFieldMask,
} from "./engines/store-field-query-engine";
import { touchFieldsOperation } from "./engines/operation-engine";
import { BitDirtyManager } from "./managers/core/dirty-manager";
import { BitMaskManager } from "./managers/features/mask-manager";
import { BitFieldRegistry } from "./registry/field-registry";
import {
  clearPersistedFeature,
  forceSavePersistedFeature,
  readHistoryFeatureMetadata,
  restorePersistedFeature,
  runRedoFeature,
  runUndoFeature,
} from "./orchestration/store-feature-ops";
import { BIT_FRAMEWORK_STORE_SYMBOL } from "./orchestration/framework-store-brand";
import { BIT_HOOKS_API_SYMBOL } from "./orchestration/hook-brand";
import {
  registerStoreField,
  unregisterStoreField,
  unregisterStorePrefix,
} from "./orchestration/store-registration-ops";
import {
  subscribeStoreFieldState,
  subscribeStoreFormMeta,
  subscribeStoreHistoryMeta,
  subscribeStorePath,
  subscribeStorePersistMeta,
  subscribeStoreScopeStatus,
  subscribeStoreSelector,
  subscribeStoreTracked,
} from "./orchestration/store-observe-ops";
import { applyStorePersistedValues } from "./orchestration/store-persist-ops";
import { composeBitStoreRuntime } from "./orchestration/store-composition-root";
import { BitStoreRuntimeKernel } from "./orchestration/store-runtime-kernel";

class BitStore<T extends object = any> {
  public readonly [BIT_HOOKS_API_SYMBOL] = true;
  public readonly [BIT_FRAMEWORK_STORE_SYMBOL] = true;

  private readonly runtime: BitStoreRuntimeKernel<T>;
  private readonly _config: BitFrameworkConfig<T>;

  public readonly storeId: string;
  get config(): Readonly<BitFrameworkConfig<T>> {
    return this._config;
  }

  private readonly fieldRegistry: BitFieldRegistry<T>;
  private readonly maskManager: BitMaskManager;
  private readonly dirtyManager: BitDirtyManager<T>;
  private readonly initialValuesRef: {
    get(): T;
    set(values: T): void;
  };

  constructor(config: BitConfig<T> = {}) {
    const composition = composeBitStoreRuntime<T>({
      rawConfig: config,
      storeInstance: this,
    });

    this._config = composition.config;
    this.storeId = composition.storeId;
    this.runtime = composition.runtime;
    this.fieldRegistry = composition.fieldRegistry;
    this.maskManager = composition.maskManager;
    this.dirtyManager = composition.dirtyManager;
    this.initialValuesRef = composition.initialValuesRef;
  }

  getConfig() {
    return this._config;
  }

  getFieldConfig(path: string): BitFieldDefinition<T> | undefined {
    return this.fieldRegistry.getFieldConfig(path);
  }

  getScopeFields(scopeName: string): string[] {
    return this.fieldRegistry.getScopeFields(scopeName);
  }

  resolveMask(path: string): BitMask | undefined {
    return resolveFieldMask<T>({
      path,
      getFieldConfig: (fieldPath) => this.getFieldConfig(fieldPath),
      masks: this.maskManager.getAllMasks() as Record<BitMaskName, BitMask>,
    });
  }

  createArrayItemId(path: string, index?: number): string {
    return this._config.idFactory({
      scope: "array",
      path,
      index,
    });
  }

  getState(): BitState<T> {
    return this.runtime.getState();
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
    return this.getState().isValid;
  }

  get isSubmitting(): boolean {
    return this.getState().isSubmitting;
  }

  get isDirty(): boolean {
    return this.getState().isDirty;
  }

  registerField(path: string, config: BitFieldDefinition<T>) {
    registerStoreField({
      path,
      config,
      state: this.getState(),
      fieldRegistry: this.fieldRegistry,
      subscriptions: this.runtime.subscriptions,
      invalidateFieldIndexes: () => {
        this.fieldRegistry.invalidateIndexes();
      },
    });
  }

  unregisterField(path: string) {
    unregisterStoreField({
      path,
      state: this.getState(),
      hasStaticConfig: !!this._config.fields?.[path as string],
      fieldRegistry: this.fieldRegistry,
      subscriptions: this.runtime.subscriptions,
      validationCleanupField: (fieldPath) =>
        this.runtime.capabilities.validation.cleanupField(fieldPath),
      invalidateFieldIndexes: () => {
        this.fieldRegistry.invalidateIndexes();
      },
      dispatch: (operation) => this.runtime.dispatch(operation),
    });
  }

  unregisterPrefix(prefix: string) {
    unregisterStorePrefix({
      prefix,
      state: this.getState(),
      fieldRegistry: this.fieldRegistry,
      subscriptions: this.runtime.subscriptions,
      validationCleanupPrefix: (fieldPrefix) =>
        this.runtime.capabilities.validation.cleanupPrefix(fieldPrefix),
      invalidateFieldIndexes: () => {
        this.fieldRegistry.invalidateIndexes();
      },
    });
  }

  isHidden<P extends BitPath<T>>(path: P): boolean {
    return this.runtime.capabilities.query.isHidden(path);
  }

  isRequired<P extends BitPath<T>>(path: P): boolean {
    return this.runtime.capabilities.query.isRequired(path);
  }

  isFieldDirty(path: string): boolean {
    return this.runtime.capabilities.query.isFieldDirty(path);
  }

  isFieldValidating(path: string): boolean {
    return this.runtime.capabilities.query.isFieldValidating(path);
  }

  subscribe(listener: () => void): () => void {
    return this.runtime.subscriptions.subscribe(listener);
  }

  subscribePersistMeta(
    listener: (meta: BitPersistMetadata) => void,
  ): () => void {
    return subscribeStorePersistMeta({
      listener,
      subscribeSelector: (selector, persistListener, options) =>
        this.subscribeSelector(selector, persistListener, options),
    });
  }

  subscribeHistoryMeta(
    listener: (meta: BitHistoryMetadata) => void,
  ): () => void {
    return subscribeStoreHistoryMeta({
      readHistoryMeta: () => this.getHistoryMetadata(),
      subscribe: (metaListener) => this.subscribe(metaListener),
      listener,
    });
  }

  subscribeScopeStatus(
    scopeName: string,
    listener: (status: ScopeStatus) => void,
  ): () => void {
    return subscribeStoreScopeStatus({
      scopeName,
      readScopeStatus: (targetScopeName) =>
        this.getScopeStatus(targetScopeName),
      getScopeFields: (targetScopeName) => this.getScopeFields(targetScopeName),
      subscribeSelector: (selector, statusListener, options) =>
        this.subscribeSelector(selector, statusListener, options),
      listener,
    });
  }

  subscribeSelector<TSlice>(
    selector: BitSelector<T, TSlice>,
    listener: (slice: TSlice) => void,
    options?: BitSelectorSubscriptionOptions<TSlice>,
  ) {
    return subscribeStoreSelector({
      subscriptions: this.runtime.subscriptions,
      selector,
      listener,
      options,
    });
  }

  subscribeTracked<TSlice>(
    selector: BitSelector<T, TSlice>,
    listener: (slice: TSlice) => void,
    options?: Omit<BitSelectorSubscriptionOptions<TSlice>, "paths">,
  ) {
    return subscribeStoreTracked({
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
    return subscribeStorePath({
      path,
      listener,
      options,
      subscribeSelector: (selector, pathListener, pathOptions) =>
        this.subscribeSelector(selector, pathListener, pathOptions),
    });
  }

  subscribeFieldState<P extends BitPath<T>>(
    path: P,
    listener: (state: Readonly<BitFieldState<T, BitPathValue<T, P>>>) => void,
  ): () => void {
    return subscribeStoreFieldState({
      path,
      listener,
      getFieldState: (fieldPath) => this.getFieldState(fieldPath),
      subscribeSelector: (selector, fieldStateListener, fieldStateOptions) =>
        this.subscribeSelector(selector, fieldStateListener, fieldStateOptions),
    });
  }

  subscribeFormMeta(listener: (meta: BitFormMeta) => void): () => void {
    return subscribeStoreFormMeta({
      listener,
      subscribeSelector: (selector, metaListener, metaOptions) =>
        this.subscribeSelector(selector, metaListener, metaOptions),
    });
  }

  setField<P extends BitPath<T>>(path: P, value: BitPathValue<T, P>) {
    this.setFieldWithMeta(path as string, value, { origin: "setField" });
  }

  private setFieldWithMeta(
    path: string,
    value: any,
    meta: BitFieldChangeMeta = { origin: "setField" },
  ) {
    this.runtime.runBatch(() => {
      this.runtime.capabilities.lifecycle.updateField(path, value, meta);
    });
  }

  blurField<P extends BitPath<T>>(path: P) {
    this.runtime.saveHistorySnapshot();

    if (!this.runtime.capabilities.query.isTouched(path as string)) {
      this.runtime.runBatch(() => {
        this.runtime.dispatch(touchFieldsOperation([path as string]));
      });
    }

    this.runtime.capabilities.validation.trigger([path]);
  }

  markFieldsTouched(paths: string[]) {
    if (paths.length === 0) return;
    this.runtime.dispatch(touchFieldsOperation(paths));
  }

  setValues(
    values: T | DeepPartial<T>,
    options?: { partial?: boolean; rebase?: boolean },
  ) {
    this.runtime.capabilities.lifecycle.setValues(values, options);
  }

  setError(path: string, message: string | undefined) {
    this.runtime.capabilities.error.setError(path, message);
  }

  setErrors(errors: BitErrors<T>) {
    this.runtime.capabilities.error.setErrors(errors);
  }

  setServerErrors(serverErrors: Record<string, string[] | string>) {
    this.runtime.capabilities.error.setServerErrors(serverErrors);
  }

  reset() {
    this.runtime.capabilities.lifecycle.reset();
  }

  transaction<TResult>(callback: () => TResult): TResult {
    return this.runtime.runBatch(callback);
  }

  async submit(
    onSuccess: (values: T, dirtyValues?: Partial<T>) => void | Promise<void>,
  ): Promise<BitSubmitResult> {
    return this.runtime.capabilities.lifecycle.submit(onSuccess);
  }

  getDirtyValues(): Partial<T> {
    return this.dirtyManager.buildDirtyValues(this.getState().values);
  }

  getPersistMetadata(): BitPersistMetadata {
    return this.getState().persist;
  }

  async restorePersisted(): Promise<boolean> {
    return restorePersistedFeature({
      dispatch: (operation) => this.runtime.dispatch(operation),
      effects: this.runtime.effects,
    });
  }

  async forceSave(): Promise<void> {
    return forceSavePersistedFeature({
      dispatch: (operation) => this.runtime.dispatch(operation),
      effects: this.runtime.effects,
    });
  }

  async clearPersisted(): Promise<void> {
    return clearPersistedFeature({
      dispatch: (operation) => this.runtime.dispatch(operation),
      effects: this.runtime.effects,
    });
  }

  pushItem<P extends BitArrayPath<T>>(
    path: P,
    value: BitArrayItem<BitPathValue<T, P>>,
  ) {
    this.runtime.capabilities.arrays.pushItem(path, value);
  }

  prependItem<P extends BitArrayPath<T>>(
    path: P,
    value: BitArrayItem<BitPathValue<T, P>>,
  ) {
    this.runtime.capabilities.arrays.prependItem(path, value);
  }

  insertItem<P extends BitArrayPath<T>>(
    path: P,
    index: number,
    value: BitArrayItem<BitPathValue<T, P>>,
  ) {
    this.runtime.capabilities.arrays.insertItem(path, index, value);
  }

  removeItem<P extends BitArrayPath<T>>(path: P, index: number) {
    this.runtime.capabilities.arrays.removeItem(path, index);
  }

  swapItems<P extends BitArrayPath<T>>(
    path: P,
    indexA: number,
    indexB: number,
  ) {
    this.runtime.capabilities.arrays.swapItems(path, indexA, indexB);
  }

  moveItem<P extends BitArrayPath<T>>(path: P, from: number, to: number) {
    this.runtime.capabilities.arrays.moveItem(path, from, to);
  }

  replaceItems<P extends BitArrayPath<T>>(
    path: P,
    items: BitArrayItem<BitPathValue<T, P>>[],
  ) {
    this.runtime.capabilities.arrays.replaceItems(path, items);
  }

  clearItems<P extends BitArrayPath<T>>(path: P) {
    this.runtime.capabilities.arrays.clearItems(path);
  }

  get canUndo(): boolean {
    return this.runtime.capabilities.history.canUndo;
  }

  get canRedo(): boolean {
    return this.runtime.capabilities.history.canRedo;
  }

  undo() {
    runUndoFeature({
      history: this.runtime.capabilities.history,
      applyHistoryState: (values) =>
        this.runtime.capabilities.lifecycle.applyHistoryState(values),
    });
  }

  redo() {
    runRedoFeature({
      history: this.runtime.capabilities.history,
      applyHistoryState: (values) =>
        this.runtime.capabilities.lifecycle.applyHistoryState(values),
    });
  }

  getHistoryMetadata(): BitHistoryMetadata {
    return readHistoryFeatureMetadata({
      history: this.runtime.capabilities.history,
    });
  }

  validate(options?: BitValidationOptions): Promise<boolean> {
    return this.runtime.capabilities.validation.validate(options);
  }

  hasValidationsInProgress(scopeFields?: string[]): boolean {
    return this.runtime.capabilities.validation.hasValidationsInProgress(
      scopeFields,
    );
  }

  triggerValidation(
    scopeFields?: string[],
    options?: BitValidationTriggerOptions,
  ) {
    this.runtime.capabilities.validation.trigger(scopeFields, options);
  }

  getScopeStatus(scopeName: string) {
    return this.runtime.capabilities.scope.getScopeStatus(scopeName);
  }

  getStepErrors(scopeName: string): Record<string, string> {
    return this.runtime.capabilities.scope.getStepErrors(scopeName);
  }

  private applyPersistedValues(values: Partial<T>) {
    applyStorePersistedValues({
      values,
      state: this.getState(),
      initialValues: this.initialValuesRef.get(),
      validation: this.runtime.capabilities.validation,
      fieldRegistry: this.fieldRegistry,
      dirtyManager: this.dirtyManager,
      dispatch: (operation) => this.runtime.dispatch(operation),
      saveHistorySnapshot: () => this.runtime.saveHistorySnapshot(),
    });
  }

  cleanup() {
    this.runtime.cleanup();
  }
}

export function createInternalBitStore<T extends object = any>(
  config: BitConfig<T> = {},
) {
  return new BitStore<T>(config);
}
