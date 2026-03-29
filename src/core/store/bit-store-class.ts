import type { BitMask } from "../mask/types";
import type {
  BitArrayItem,
  BitArrayPath,
  BitConfig,
  BitErrors,
  BitFieldDefinition,
  BitFieldState,
  BitPath,
  BitPathValue,
  BitSubmitResult,
  DeepPartial,
} from "./contracts/types";
import type {
  BitFrameworkConfig,
  BitStoreFeatureApi,
  BitStoreObserveSliceApi,
  BitStoreReadSliceApi,
  BitStoreWriteSliceApi,
} from "./contracts/public/store-api-types";
import type { BitValidationOptions } from "./contracts/public/meta-types";
import type {
  BitScopedSelectorSubscriptionOptions,
  BitSelector,
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
import { resolveFieldMask } from "./engines/store-field-query-engine";
import { buildStoreSlicesApi } from "./orchestration/store-slices-factory";
import {
  createBitStoreDomains,
  type BitStoreDomains,
} from "./orchestration/store-domains";
import { BitStoreStateReader } from "./shared/store-state-reader";

export class BitStore<T extends object = Record<string, unknown>> {
  public readonly [BIT_HOOKS_API_SYMBOL] = true;
  public readonly [BIT_FRAMEWORK_STORE_SYMBOL] = true;

  public readonly storeId: string;

  private readonly runtime: BitStoreRuntimeKernel<T>;
  private readonly _config: BitFrameworkConfig<T>;
  private readonly fieldRegistry: BitFieldRegistry<T>;
  private readonly maskManager: BitMaskManager;
  private readonly dirtyManager: BitDirtyManager<T>;
  private readonly stateReader: BitStoreStateReader<T>;
  private readonly domains: BitStoreDomains<T>;

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
      isFieldDirty: (path) =>
        this.runtime.capabilities.query.isFieldDirty(path),
      isFieldValidating: (path) =>
        this.runtime.capabilities.query.isFieldValidating(path),
    });

    this.domains = createBitStoreDomains<T>({
      runtime: this.runtime,
      config: this._config,
      fieldRegistry: this.fieldRegistry,
      dirtyManager: this.dirtyManager,
      stateReader: this.stateReader,
    });

    const slices = buildStoreSlicesApi<T>({
      identity: {
        storeId: this.storeId,
        config: this._config,
      },
      read: this.domains.read,
      observe: this.domains.observe,
      write: this.domains.write,
      feature: this.domains.feature,
      getFieldConfig: (path) => this.getFieldConfig(path),
      resolveMask: (path) => this.resolveMask(path),
      createArrayItemId: (path, index) => this.createArrayItemId(path, index),
    });

    this.read = slices.read;
    this.observe = slices.observe;
    this.write = slices.write;
    this.feature = slices.feature;
  }

  get config(): Readonly<BitFrameworkConfig<T>> {
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

  getState() {
    return this.domains.read.getState();
  }

  getFieldState<P extends BitPath<T>>(
    path: P,
  ): BitFieldState<T, BitPathValue<T, P>> {
    return this.domains.read.getFieldState(path);
  }

  get isValid(): boolean {
    return this.domains.read.getIsValid();
  }

  get isSubmitting(): boolean {
    return this.domains.read.getIsSubmitting();
  }

  get isDirty(): boolean {
    return this.domains.read.getIsDirty();
  }

  isHidden<P extends BitPath<T>>(path: P): boolean {
    return this.domains.read.isHidden(path);
  }

  isRequired<P extends BitPath<T>>(path: P): boolean {
    return this.domains.read.isRequired(path);
  }

  isFieldDirty(path: string): boolean {
    return this.domains.read.isFieldDirty(path);
  }

  isFieldValidating(path: string): boolean {
    return this.domains.read.isFieldValidating(path);
  }

  getDirtyValues(): Partial<T> {
    return this.domains.read.getDirtyValues();
  }

  getPersistMetadata() {
    return this.domains.read.getPersistMetadata();
  }

  getHistoryMetadata() {
    return this.domains.read.getHistoryMetadata();
  }

  getScopeStatus(scopeName: string) {
    return this.domains.read.getScopeStatus(scopeName);
  }

  getScopeErrors(scopeName: string): Record<string, string> {
    return this.domains.read.getScopeErrors(scopeName);
  }

  registerField(path: string, config: BitFieldDefinition<T>): void {
    this.domains.write.registerField(path, config);
  }

  unregisterField(path: string): void {
    this.domains.write.unregisterField(path);
  }

  unregisterPrefix(prefix: string): void {
    this.domains.write.unregisterPrefix(prefix);
  }

  subscribe(listener: () => void): () => void {
    return this.domains.observe.subscribe(listener);
  }

  subscribePersistMeta(
    listener: (
      meta: ReturnType<BitStoreDomains<T>["read"]["getPersistMetadata"]>,
    ) => void,
  ): () => void {
    return this.domains.observe.subscribePersistMeta(listener);
  }

  subscribeHistoryMeta(
    listener: (
      meta: ReturnType<BitStoreDomains<T>["read"]["getHistoryMetadata"]>,
    ) => void,
  ): () => void {
    return this.domains.observe.subscribeHistoryMeta(listener);
  }

  subscribeScopeStatus(
    scopeName: string,
    listener: (
      status: ReturnType<BitStoreDomains<T>["read"]["getScopeStatus"]>,
    ) => void,
  ): () => void {
    return this.domains.observe.subscribeScopeStatus(scopeName, listener);
  }

  subscribeSelector<TSlice>(
    selector: BitSelector<T, TSlice>,
    listener: (slice: TSlice) => void,
    options?: BitSelectorSubscriptionOptions<TSlice>,
  ): () => void {
    return this.domains.observe.subscribeSelector(selector, listener, options);
  }

  subscribePath<P extends BitPath<T>>(
    path: P,
    listener: (value: BitPathValue<T, P>) => void,
    options?: BitScopedSelectorSubscriptionOptions<BitPathValue<T, P>>,
  ): () => void {
    return this.domains.observe.subscribePath(path, listener, options);
  }

  subscribeFieldState<P extends BitPath<T>>(
    path: P,
    listener: (state: Readonly<BitFieldState<T, BitPathValue<T, P>>>) => void,
  ): () => void {
    return this.domains.observe.subscribeFieldState(path, listener);
  }

  subscribeFormMeta(
    listener: Parameters<BitStoreDomains<T>["observe"]["subscribeFormMeta"]>[0],
  ): () => void {
    return this.domains.observe.subscribeFormMeta(listener);
  }

  setField<P extends BitPath<T>>(path: P, value: BitPathValue<T, P>): void {
    this.domains.write.setField(path, value);
  }

  blurField<P extends BitPath<T>>(path: P): void {
    this.domains.write.blurField(path);
  }

  markFieldsTouched(paths: string[]): void {
    this.domains.write.markFieldsTouched(paths);
  }

  setValues(
    values: T | DeepPartial<T>,
    options?: { partial?: boolean; rebase?: boolean },
  ): void {
    this.domains.write.setValues(values, options);
  }

  setError(path: string, message: string | undefined): void {
    this.domains.write.setError(path, message);
  }

  setErrors(errors: BitErrors<T>): void {
    this.domains.write.setErrors(errors);
  }

  setServerErrors(serverErrors: Record<string, string[] | string>): void {
    this.domains.write.setServerErrors(serverErrors);
  }

  reset(): void {
    this.domains.write.reset();
  }

  transaction<TResult>(callback: () => TResult): TResult {
    return this.domains.write.transaction(callback);
  }

  async submit(
    onSuccess: (values: T, dirtyValues?: Partial<T>) => void | Promise<void>,
  ): Promise<BitSubmitResult> {
    return this.domains.write.submit(onSuccess);
  }

  pushItem<P extends BitArrayPath<T>>(
    path: P,
    value: BitArrayItem<BitPathValue<T, P>>,
  ): void {
    this.domains.write.pushItem(path, value);
  }

  prependItem<P extends BitArrayPath<T>>(
    path: P,
    value: BitArrayItem<BitPathValue<T, P>>,
  ): void {
    this.domains.write.prependItem(path, value);
  }

  insertItem<P extends BitArrayPath<T>>(
    path: P,
    index: number,
    value: BitArrayItem<BitPathValue<T, P>>,
  ): void {
    this.domains.write.insertItem(path, index, value);
  }

  removeItem<P extends BitArrayPath<T>>(path: P, index: number): void {
    this.domains.write.removeItem(path, index);
  }

  swapItems<P extends BitArrayPath<T>>(
    path: P,
    indexA: number,
    indexB: number,
  ): void {
    this.domains.write.swapItems(path, indexA, indexB);
  }

  moveItem<P extends BitArrayPath<T>>(path: P, from: number, to: number): void {
    this.domains.write.moveItem(path, from, to);
  }

  replaceItems<P extends BitArrayPath<T>>(
    path: P,
    items: BitArrayItem<BitPathValue<T, P>>[],
  ): void {
    this.domains.write.replaceItems(path, items);
  }

  clearItems<P extends BitArrayPath<T>>(path: P): void {
    this.domains.write.clearItems(path);
  }

  get canUndo(): boolean {
    return this.domains.read.getCanUndo();
  }

  get canRedo(): boolean {
    return this.domains.read.getCanRedo();
  }

  undo(): void {
    this.domains.feature.undo();
  }

  redo(): void {
    this.domains.feature.redo();
  }

  validate(options?: BitValidationOptions): Promise<boolean> {
    return this.domains.feature.validate(options);
  }

  hasValidationsInProgress(scopeFields?: string[]): boolean {
    return this.domains.feature.hasValidationsInProgress(scopeFields);
  }

  triggerValidation(
    scopeFields?: string[],
    options?: BitValidationTriggerOptions,
  ): void {
    this.domains.feature.triggerValidation(scopeFields, options);
  }

  async restorePersisted(): Promise<boolean> {
    return this.domains.feature.restorePersisted();
  }

  async forceSave(): Promise<void> {
    return this.domains.feature.forceSave();
  }

  async clearPersisted(): Promise<void> {
    return this.domains.feature.clearPersisted();
  }

  cleanup(): void {
    this.domains.feature.cleanup();
  }
}
