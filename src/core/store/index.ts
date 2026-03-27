import type { BitMask } from "../mask/types";
import type {
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
  DeepPartial,
  ScopeStatus,
} from "./contracts/types";
import type {
  BitFrameworkConfig,
  BitStoreFeatureApi,
  BitStoreObserveSliceApi,
  BitStoreReadSliceApi,
  BitStoreWriteSliceApi,
} from "./contracts/public/store-api-types";
import type {
  BitFormMeta,
  BitHistoryMetadata,
  BitValidationOptions,
} from "./contracts/public/meta-types";
import type {
  BitSelector,
  BitScopedSelectorSubscriptionOptions,
  BitSelectorSubscriptionOptions,
} from "./contracts/public/subscription-types";
import type { BitValidationTriggerOptions } from "./contracts/port-types";
import { BIT_FRAMEWORK_STORE_SYMBOL } from "./orchestration/framework-store-brand";
import { BIT_HOOKS_API_SYMBOL } from "./orchestration/hook-brand";
import { composeBitStoreRuntime } from "./orchestration/store-composition-root";
import type { BitStoreRuntimeKernel } from "./orchestration/store-runtime-kernel";
import type { BitFieldRegistry } from "./registry/field-registry";
import type { BitMaskManager } from "./managers/features/mask-manager";
import type { BitDirtyManager } from "./managers/core/dirty-manager";
import { touchFieldsOperation } from "./engines/operation-engine";
import { resolveFieldMask } from "./engines/store-field-query-engine";
import {
  clearPersistedFeature,
  forceSavePersistedFeature,
  readHistoryFeatureMetadata,
  restorePersistedFeature,
  runRedoFeature,
  runUndoFeature,
} from "./orchestration/store-feature-ops";
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
} from "./orchestration/store-observe-ops";
import { createStoreNamespacesFromFacadeHost } from "./orchestration/store-facade";
import { BitStoreStateReader } from "./shared/store-state-reader";

class BitStore<T extends object = Record<string, unknown>> {
  public readonly [BIT_HOOKS_API_SYMBOL] = true;
  public readonly [BIT_FRAMEWORK_STORE_SYMBOL] = true;

  public readonly storeId: string;

  private readonly runtime: BitStoreRuntimeKernel<T>;
  private readonly _config: BitFrameworkConfig<T>;
  private readonly fieldRegistry: BitFieldRegistry<T>;
  private readonly maskManager: BitMaskManager;
  private readonly dirtyManager: BitDirtyManager<T>;
  private readonly stateReader: BitStoreStateReader<T>;

  public readonly read: BitStoreReadSliceApi<T>;
  public readonly observe: BitStoreObserveSliceApi<T>;
  public readonly write: BitStoreWriteSliceApi<T>;
  public readonly feature: BitStoreFeatureApi<T>;

  constructor(config: BitConfig<T> = {}) {
    const storeBusPort = {
      getState: () => this.getState(),
      getHistoryMetadata: () => this.getHistoryMetadata(),
      undo: () => this.undo(),
      redo: () => this.redo(),
      reset: () => this.reset(),
    };

    const composition = composeBitStoreRuntime<T>({
      rawConfig: config,
      storeBusPort,
    });

    this._config = composition.config;
    this.storeId = composition.storeId;
    this.runtime = composition.runtime;
    this.fieldRegistry = composition.fieldRegistry;
    this.maskManager = composition.maskManager;
    this.dirtyManager = composition.dirtyManager;
    this.stateReader = new BitStoreStateReader<T>({
      getState: () => this.runtime.getState(),
      isHidden: (path) => this.runtime.capabilities.query.isHidden(path),
      isRequired: (path) => this.runtime.capabilities.query.isRequired(path),
      isFieldDirty: (path) => this.runtime.capabilities.query.isFieldDirty(path),
      isFieldValidating: (path) =>
        this.runtime.capabilities.query.isFieldValidating(path),
    });

    const slices = createStoreNamespacesFromFacadeHost(this);

    this.read = slices.read;
    this.observe = slices.observe;
    this.write = slices.write;
    this.feature = slices.feature;
  }

  // ── Config ───────────────────────────────────────────────────────────────

  get config(): Readonly<BitFrameworkConfig<T>> {
    return this._config;
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
      masks: this.maskManager.getAllMasks(),
    });
  }

  createArrayItemId(path: string, index?: number): string {
    return this._config.idFactory({ scope: "array", path, index });
  }

  // ── State Read ───────────────────────────────────────────────────────────

  getState() {
    return this.stateReader.getState();
  }

  getFieldState<P extends BitPath<T>>(
    path: P,
  ): BitFieldState<T, BitPathValue<T, P>> {
    return this.stateReader.getFieldState(path);
  }

  get isValid(): boolean {
    return this.stateReader.getFlag("isValid");
  }

  get isSubmitting(): boolean {
    return this.stateReader.getFlag("isSubmitting");
  }

  get isDirty(): boolean {
    return this.stateReader.getFlag("isDirty");
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

  getDirtyValues(): Partial<T> {
    return this.dirtyManager.buildDirtyValues(this.getState().values);
  }

  getPersistMetadata(): BitPersistMetadata {
    return this.stateReader.getPersistMetadata();
  }

  getHistoryMetadata(): BitHistoryMetadata {
    return readHistoryFeatureMetadata({
      history: this.runtime.capabilities.history,
    });
  }

  getScopeStatus(scopeName: string): ScopeStatus {
    return this.runtime.capabilities.scope.getScopeStatus(scopeName);
  }

  getScopeErrors(scopeName: string): Record<string, string> {
    return this.runtime.capabilities.scope.getScopeErrors(scopeName);
  }

  // ── Registration ─────────────────────────────────────────────────────────

  registerField(path: string, config: BitFieldDefinition<T>): void {
    registerStoreField({
      path,
      config,
      state: this.runtime.getState(),
      fieldRegistry: this.fieldRegistry,
      subscriptions: this.runtime.subscriptions,
      invalidateFieldIndexes: () => {
        this.fieldRegistry.invalidateIndexes();
      },
    });
  }

  unregisterField(path: string): void {
    unregisterStoreField({
      path,
      state: this.runtime.getState(),
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

  unregisterPrefix(prefix: string): void {
    unregisterStorePrefix({
      prefix,
      state: this.runtime.getState(),
      fieldRegistry: this.fieldRegistry,
      subscriptions: this.runtime.subscriptions,
      validationCleanupPrefix: (fieldPrefix) =>
        this.runtime.capabilities.validation.cleanupPrefix(fieldPrefix),
      invalidateFieldIndexes: () => {
        this.fieldRegistry.invalidateIndexes();
      },
    });
  }

  // ── Subscriptions ────────────────────────────────────────────────────────

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
      subscribeSelector: (selector, historyListener, options) =>
        this.subscribeSelector(selector, historyListener, options),
      listener,
    });
  }

  subscribeScopeStatus(
    scopeName: string,
    listener: (status: ScopeStatus) => void,
  ): () => void {
    return subscribeStoreScopeStatus({
      scopeName,
      getScopeFields: (name) => this.getScopeFields(name),
      readScopeStatus: (name) => this.getScopeStatus(name),
      subscribeSelector: (selector, scopeListener, options) =>
        this.subscribeSelector(selector, scopeListener, options),
      listener,
    });
  }

  subscribeSelector<TSlice>(
    selector: BitSelector<T, TSlice>,
    listener: (slice: TSlice) => void,
    options?: BitSelectorSubscriptionOptions<TSlice>,
  ): () => void {
    return subscribeStoreSelector({
      getState: () => this.getState(),
      subscriptions: this.runtime.subscriptions,
      selector,
      listener,
      options,
    });
  }

  subscribePath<P extends BitPath<T>>(
    path: P,
    listener: (value: BitPathValue<T, P>) => void,
    options?: BitScopedSelectorSubscriptionOptions<BitPathValue<T, P>>,
  ): () => void {
    return subscribeStorePath({
      path,
      listener,
      options,
      subscribeSelector: (selector, pathListener, selectorOptions) =>
        this.subscribeSelector(selector, pathListener, selectorOptions),
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
      subscribeSelector: (selector, fieldListener, options) =>
        this.subscribeSelector(selector, fieldListener, options),
    });
  }

  subscribeFormMeta(listener: (meta: BitFormMeta) => void): () => void {
    return subscribeStoreFormMeta({
      listener,
      subscribeSelector: (selector, metaListener, options) =>
        this.subscribeSelector(selector, metaListener, options),
    });
  }

  // ── Mutations ────────────────────────────────────────────────────────────

  setField<P extends BitPath<T>>(path: P, value: BitPathValue<T, P>): void {
    this.setFieldWithMeta(path as string, value, { origin: "setField" });
  }

  private setFieldWithMeta(
    path: string,
    value: unknown,
    meta: BitFieldChangeMeta = { origin: "setField" },
  ): void {
    this.runtime.runBatch(() => {
      this.runtime.capabilities.lifecycle.updateField(path, value, meta);
    });
  }

  blurField<P extends BitPath<T>>(path: P): void {
    if (!this.runtime.capabilities.query.isTouched(path as string)) {
      this.runtime.runBatch(() => {
        this.runtime.dispatch(touchFieldsOperation([path as string]));
      });
    }

    this.runtime.capabilities.validation.trigger([path]);
  }

  markFieldsTouched(paths: string[]): void {
    if (paths.length === 0) return;
    this.runtime.dispatch(touchFieldsOperation(paths));
  }

  setValues(
    values: T | DeepPartial<T>,
    options?: { partial?: boolean; rebase?: boolean },
  ): void {
    this.runtime.capabilities.lifecycle.setValues(values, options);
  }

  setError(path: string, message: string | undefined): void {
    this.runtime.capabilities.error.setError(path, message);
  }

  setErrors(errors: BitErrors<T>): void {
    this.runtime.capabilities.error.setErrors(errors);
  }

  setServerErrors(serverErrors: Record<string, string[] | string>): void {
    this.runtime.capabilities.error.setServerErrors(serverErrors);
  }

  reset(): void {
    this.runtime.runBatch(() => {
      this.runtime.capabilities.lifecycle.reset();
    });
  }

  transaction<TResult>(callback: () => TResult): TResult {
    return this.runtime.runBatch(callback);
  }

  async submit(
    onSuccess: (values: T, dirtyValues?: Partial<T>) => void | Promise<void>,
  ): Promise<BitSubmitResult> {
    return this.runtime.capabilities.lifecycle.submit(onSuccess);
  }

  // ── Arrays ───────────────────────────────────────────────────────────────

  pushItem<P extends BitArrayPath<T>>(
    path: P,
    value: BitArrayItem<BitPathValue<T, P>>,
  ): void {
    this.runtime.capabilities.arrays.pushItem(path, value);
  }

  prependItem<P extends BitArrayPath<T>>(
    path: P,
    value: BitArrayItem<BitPathValue<T, P>>,
  ): void {
    this.runtime.capabilities.arrays.prependItem(path, value);
  }

  insertItem<P extends BitArrayPath<T>>(
    path: P,
    index: number,
    value: BitArrayItem<BitPathValue<T, P>>,
  ): void {
    this.runtime.capabilities.arrays.insertItem(path, index, value);
  }

  removeItem<P extends BitArrayPath<T>>(path: P, index: number): void {
    this.runtime.capabilities.arrays.removeItem(path, index);
  }

  swapItems<P extends BitArrayPath<T>>(
    path: P,
    indexA: number,
    indexB: number,
  ): void {
    this.runtime.capabilities.arrays.swapItems(path, indexA, indexB);
  }

  moveItem<P extends BitArrayPath<T>>(path: P, from: number, to: number): void {
    this.runtime.capabilities.arrays.moveItem(path, from, to);
  }

  replaceItems<P extends BitArrayPath<T>>(
    path: P,
    items: BitArrayItem<BitPathValue<T, P>>[],
  ): void {
    this.runtime.capabilities.arrays.replaceItems(path, items);
  }

  clearItems<P extends BitArrayPath<T>>(path: P): void {
    this.runtime.capabilities.arrays.clearItems(path);
  }

  // ── History ──────────────────────────────────────────────────────────────

  get canUndo(): boolean {
    return this.runtime.capabilities.history.canUndo;
  }

  get canRedo(): boolean {
    return this.runtime.capabilities.history.canRedo;
  }

  undo(): void {
    runUndoFeature({
      history: this.runtime.capabilities.history,
      applyHistoryState: (values) =>
        this.runtime.capabilities.lifecycle.applyHistoryState(values),
    });
  }

  redo(): void {
    runRedoFeature({
      history: this.runtime.capabilities.history,
      applyHistoryState: (values) =>
        this.runtime.capabilities.lifecycle.applyHistoryState(values),
    });
  }

  // ── Validation ───────────────────────────────────────────────────────────

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
  ): void {
    this.runtime.capabilities.validation.trigger(scopeFields, options);
  }

  // ── Persist ──────────────────────────────────────────────────────────────

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

  // ── Lifecycle ────────────────────────────────────────────────────────────

  cleanup(): void {
    this.runtime.cleanup();
  }
}

export function createInternalBitStore<
  T extends object = Record<string, unknown>,
>(config: BitConfig<T> = {}) {
  return new BitStore<T>(config);
}
