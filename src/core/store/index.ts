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
  BitPersistMetadata,
  BitSubmitResult,
  DeepPartial,
  ScopeStatus,
} from "./contracts/types";
import type { BitFrameworkConfig } from "./contracts/public/store-api-types";
import type {
  BitFormMeta,
  BitHistoryMetadata,
  BitValidationOptions,
} from "./contracts/public/meta-types";
import type {
  BitSelector,
  BitSelectorSubscriptionOptions,
} from "./contracts/public/subscription-types";
import type { BitValidationTriggerOptions } from "./contracts/port-types";
import { BIT_FRAMEWORK_STORE_SYMBOL } from "./orchestration/framework-store-brand";
import { BIT_HOOKS_API_SYMBOL } from "./orchestration/hook-brand";
import { composeBitStoreRuntime } from "./orchestration/store-composition-root";
import { BitStoreRuntimeKernel } from "./orchestration/store-runtime-kernel";
import { BitStoreReadFacade } from "./facades/store-read-facade";
import { BitStoreObserveFacade } from "./facades/store-observe-facade";
import { BitStoreWriteFacade } from "./facades/store-write-facade";
import { BitStoreRegisterFacade } from "./facades/store-register-facade";
import { BitStoreFeatureFacade } from "./facades/store-feature-facade";

class BitStore<T extends object = Record<string, unknown>> {
  public readonly [BIT_HOOKS_API_SYMBOL] = true;
  public readonly [BIT_FRAMEWORK_STORE_SYMBOL] = true;

  public readonly storeId: string;

  private readonly runtime: BitStoreRuntimeKernel<T>;
  private readonly _config: BitFrameworkConfig<T>;

  private readonly read: BitStoreReadFacade<T>;
  private readonly observe: BitStoreObserveFacade<T>;
  private readonly write: BitStoreWriteFacade<T>;
  private readonly register: BitStoreRegisterFacade<T>;
  private readonly feature: BitStoreFeatureFacade<T>;

  constructor(config: BitConfig<T> = {}) {
    const composition = composeBitStoreRuntime<T>({
      rawConfig: config,
      storeInstance: this,
    });

    this._config = composition.config;
    this.storeId = composition.storeId;
    this.runtime = composition.runtime;

    const fieldRegistry = composition.fieldRegistry;
    const maskManager = composition.maskManager;
    const dirtyManager = composition.dirtyManager;

    this.read = new BitStoreReadFacade(
      this.runtime,
      fieldRegistry,
      maskManager,
      dirtyManager,
      this._config,
    );

    this.observe = new BitStoreObserveFacade(
      this.runtime,
      fieldRegistry,
      (path) => this.getFieldState(path),
      (scopeName) => this.getScopeStatus(scopeName),
      (scopeName) => this.getScopeFields(scopeName),
      () => this.getHistoryMetadata(),
    );

    this.write = new BitStoreWriteFacade(this.runtime);
    this.register = new BitStoreRegisterFacade(
      this.runtime,
      fieldRegistry,
      this._config,
    );
    this.feature = new BitStoreFeatureFacade(this.runtime);
  }

  // ── Config ───────────────────────────────────────────────────────────────

  get config(): Readonly<BitFrameworkConfig<T>> {
    return this._config;
  }

  getConfig() {
    return this.read.getConfig();
  }

  getFieldConfig(path: string): BitFieldDefinition<T> | undefined {
    return this.read.getFieldConfig(path);
  }

  getScopeFields(scopeName: string): string[] {
    return this.read.getScopeFields(scopeName);
  }

  resolveMask(path: string): BitMask | undefined {
    return this.read.resolveMask(path);
  }

  createArrayItemId(path: string, index?: number): string {
    return this.read.createArrayItemId(path, index);
  }

  // ── State Read ───────────────────────────────────────────────────────────

  getState() {
    return this.read.getState();
  }

  getFieldState<P extends BitPath<T>>(
    path: P,
  ): BitFieldState<T, BitPathValue<T, P>> {
    return this.read.getFieldState(path);
  }

  get isValid(): boolean {
    return this.read.isValid;
  }

  get isSubmitting(): boolean {
    return this.read.isSubmitting;
  }

  get isDirty(): boolean {
    return this.read.isDirty;
  }

  isHidden<P extends BitPath<T>>(path: P): boolean {
    return this.read.isHidden(path);
  }

  isRequired<P extends BitPath<T>>(path: P): boolean {
    return this.read.isRequired(path);
  }

  isFieldDirty(path: string): boolean {
    return this.read.isFieldDirty(path);
  }

  isFieldValidating(path: string): boolean {
    return this.read.isFieldValidating(path);
  }

  getDirtyValues(): Partial<T> {
    return this.read.getDirtyValues();
  }

  getPersistMetadata(): BitPersistMetadata {
    return this.read.getPersistMetadata();
  }

  getHistoryMetadata(): BitHistoryMetadata {
    return this.read.getHistoryMetadata();
  }

  getScopeStatus(scopeName: string): ScopeStatus {
    return this.read.getScopeStatus(scopeName);
  }

  getScopeErrors(scopeName: string): Record<string, string> {
    return this.read.getScopeErrors(scopeName);
  }

  // ── Registration ─────────────────────────────────────────────────────────

  registerField(path: string, config: BitFieldDefinition<T>): void {
    this.register.registerField(path, config);
  }

  unregisterField(path: string): void {
    this.register.unregisterField(path);
  }

  unregisterPrefix(prefix: string): void {
    this.register.unregisterPrefix(prefix);
  }

  // ── Subscriptions ────────────────────────────────────────────────────────

  subscribe(listener: () => void): () => void {
    return this.observe.subscribe(listener);
  }

  subscribePersistMeta(
    listener: (meta: BitPersistMetadata) => void,
  ): () => void {
    return this.observe.subscribePersistMeta(listener);
  }

  subscribeHistoryMeta(
    listener: (meta: BitHistoryMetadata) => void,
  ): () => void {
    return this.observe.subscribeHistoryMeta(listener);
  }

  subscribeScopeStatus(
    scopeName: string,
    listener: (status: ScopeStatus) => void,
  ): () => void {
    return this.observe.subscribeScopeStatus(scopeName, listener);
  }

  subscribeSelector<TSlice>(
    selector: BitSelector<T, TSlice>,
    listener: (slice: TSlice) => void,
    options?: BitSelectorSubscriptionOptions<TSlice>,
  ): () => void {
    return this.observe.subscribeSelector(selector, listener, options);
  }

  subscribeTracked<TSlice>(
    selector: BitSelector<T, TSlice>,
    listener: (slice: TSlice) => void,
    options?: Omit<BitSelectorSubscriptionOptions<TSlice>, "paths">,
  ): () => void {
    return this.observe.subscribeTracked(selector, listener, options);
  }

  subscribePath<P extends BitPath<T>>(
    path: P,
    listener: (value: BitPathValue<T, P>) => void,
    options?: BitSelectorSubscriptionOptions<BitPathValue<T, P>>,
  ): () => void {
    return this.observe.subscribePath(path, listener, options);
  }

  subscribeFieldState<P extends BitPath<T>>(
    path: P,
    listener: (state: Readonly<BitFieldState<T, BitPathValue<T, P>>>) => void,
  ): () => void {
    return this.observe.subscribeFieldState(path, listener);
  }

  subscribeFormMeta(listener: (meta: BitFormMeta) => void): () => void {
    return this.observe.subscribeFormMeta(listener);
  }

  // ── Mutations ────────────────────────────────────────────────────────────

  setField<P extends BitPath<T>>(path: P, value: BitPathValue<T, P>): void {
    this.write.setField(path, value);
  }

  blurField<P extends BitPath<T>>(path: P): void {
    this.write.blurField(path);
  }

  markFieldsTouched(paths: string[]): void {
    this.write.markFieldsTouched(paths);
  }

  setValues(
    values: T | DeepPartial<T>,
    options?: { partial?: boolean; rebase?: boolean },
  ): void {
    this.write.setValues(values, options);
  }

  setError(path: string, message: string | undefined): void {
    this.write.setError(path, message);
  }

  setErrors(errors: BitErrors<T>): void {
    this.write.setErrors(errors);
  }

  setServerErrors(serverErrors: Record<string, string[] | string>): void {
    this.write.setServerErrors(serverErrors);
  }

  reset(): void {
    this.write.reset();
  }

  transaction<TResult>(callback: () => TResult): TResult {
    return this.write.transaction(callback);
  }

  async submit(
    onSuccess: (values: T, dirtyValues?: Partial<T>) => void | Promise<void>,
  ): Promise<BitSubmitResult> {
    return this.write.submit(onSuccess);
  }

  // ── Arrays ───────────────────────────────────────────────────────────────

  pushItem<P extends BitArrayPath<T>>(
    path: P,
    value: BitArrayItem<BitPathValue<T, P>>,
  ): void {
    this.feature.pushItem(path, value);
  }

  prependItem<P extends BitArrayPath<T>>(
    path: P,
    value: BitArrayItem<BitPathValue<T, P>>,
  ): void {
    this.feature.prependItem(path, value);
  }

  insertItem<P extends BitArrayPath<T>>(
    path: P,
    index: number,
    value: BitArrayItem<BitPathValue<T, P>>,
  ): void {
    this.feature.insertItem(path, index, value);
  }

  removeItem<P extends BitArrayPath<T>>(path: P, index: number): void {
    this.feature.removeItem(path, index);
  }

  swapItems<P extends BitArrayPath<T>>(
    path: P,
    indexA: number,
    indexB: number,
  ): void {
    this.feature.swapItems(path, indexA, indexB);
  }

  moveItem<P extends BitArrayPath<T>>(path: P, from: number, to: number): void {
    this.feature.moveItem(path, from, to);
  }

  replaceItems<P extends BitArrayPath<T>>(
    path: P,
    items: BitArrayItem<BitPathValue<T, P>>[],
  ): void {
    this.feature.replaceItems(path, items);
  }

  clearItems<P extends BitArrayPath<T>>(path: P): void {
    this.feature.clearItems(path);
  }

  // ── History ──────────────────────────────────────────────────────────────

  get canUndo(): boolean {
    return this.feature.canUndo;
  }

  get canRedo(): boolean {
    return this.feature.canRedo;
  }

  undo(): void {
    this.feature.undo();
  }

  redo(): void {
    this.feature.redo();
  }

  // ── Validation ───────────────────────────────────────────────────────────

  validate(options?: BitValidationOptions): Promise<boolean> {
    return this.feature.validate(options);
  }

  hasValidationsInProgress(scopeFields?: string[]): boolean {
    return this.feature.hasValidationsInProgress(scopeFields);
  }

  triggerValidation(
    scopeFields?: string[],
    options?: BitValidationTriggerOptions,
  ): void {
    this.feature.triggerValidation(scopeFields, options);
  }

  // ── Persist ──────────────────────────────────────────────────────────────

  async restorePersisted(): Promise<boolean> {
    return this.feature.restorePersisted();
  }

  async forceSave(): Promise<void> {
    return this.feature.forceSave();
  }

  async clearPersisted(): Promise<void> {
    return this.feature.clearPersisted();
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────

  cleanup(): void {
    this.feature.cleanup();
  }
}

export function createInternalBitStore<
  T extends object = Record<string, unknown>,
>(config: BitConfig<T> = {}) {
  return new BitStore<T>(config);
}
