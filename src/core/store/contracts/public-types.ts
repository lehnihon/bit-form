import {
  BitErrors,
  BitFieldState,
  BitFieldDefinition,
  BitPath,
  BitPathValue,
  BitArrayPath,
  BitArrayItem,
  BitConfig,
  DevToolsOptions,
  ScopeStatus,
  ValidatorFn,
  BitState,
  BitPersistResolvedConfig,
  BitPlugin,
  DeepPartial,
  BitPersistMetadata,
  BitIdFactory,
} from "./types";
import { BitMask, BitMaskName } from "../../mask/types";

export type { BitPersistMetadata } from "./types";

export type BitSelector<T extends object, TSlice> = (
  state: Readonly<BitState<T>>,
) => TSlice;

export type BitEqualityFn<TValue> = (previous: TValue, next: TValue) => boolean;

export interface BitSelectorSubscriptionOptions<TValue> {
  equalityFn?: BitEqualityFn<TValue>;
  emitImmediately?: boolean;
  paths?: string[];
}

export interface BitValidationOptions {
  scope?: string;
  scopeFields?: string[];
}

export interface BitHistoryMetadata {
  enabled: boolean;
  canUndo: boolean;
  canRedo: boolean;
  historyIndex: number;
  historySize: number;
}

export interface BitFrameworkConfig<T extends object = any>
  extends BitConfig<T> {
  initialValues: T;
  resolver?: ValidatorFn<T>;
  validationDelay: number;
  history: { enabled: boolean; limit: number };
  masks?: Record<string, BitMask>;
  fields?: Record<string, BitFieldDefinition<T>>;
  devTools?: boolean | DevToolsOptions;
  persist: BitPersistResolvedConfig<T>;
  idFactory: BitIdFactory;
  plugins: BitPlugin<T>[];
}

export interface BitStoreQueryApi<T extends object = any> {
  readonly config: Readonly<BitFrameworkConfig<T>>;

  getConfig(): Readonly<BitFrameworkConfig<T>>;
  getState(): Readonly<BitState<T>>;

  isHidden<P extends BitPath<T>>(path: P): boolean;
  isRequired<P extends BitPath<T>>(path: P): boolean;
  isFieldDirty(path: string): boolean;
  isFieldValidating(path: string): boolean;
  getDirtyValues(): Partial<T>;
  getPersistMetadata(): BitPersistMetadata;
  getHistoryMetadata(): BitHistoryMetadata;
  getStepStatus(scopeName: string): ScopeStatus;
  getStepErrors(scopeName: string): Record<string, string>;
}

/** Snapshot of form-level reactive flags used by `subscribeFormMeta`. */
export interface BitFormMeta {
  isValid: boolean;
  isDirty: boolean;
  isSubmitting: boolean;
}

export interface BitStoreObserveApi<T extends object = any> {
  subscribe(listener: () => void): () => void;
}

export interface BitStoreWriteApi<T extends object = any> {
  setField<P extends BitPath<T>>(path: P, value: BitPathValue<T, P>): void;
  blurField<P extends BitPath<T>>(path: P): void;
  setValues(
    values: T | DeepPartial<T>,
    options?: { partial?: boolean; rebase?: boolean },
  ): void;

  setError(path: string, message: string | undefined): void;
  setErrors(errors: BitErrors<T>): void;
  setServerErrors(serverErrors: Record<string, string[] | string>): void;

  validate(options?: BitValidationOptions): Promise<boolean>;

  reset(): void;

  transaction<TResult>(callback: () => TResult): TResult;

  submit(
    onSuccess: (values: T, dirtyValues?: Partial<T>) => void | Promise<void>,
  ): Promise<void>;
}

export interface BitStoreMaskFeatureApi {
  registerMask(name: BitMaskName, mask: BitMask): void;
  unregisterMask(name: BitMaskName): void;
}

export interface BitStorePersistFeatureApi {
  getPersistMetadata(): BitPersistMetadata;
  restorePersisted(): Promise<boolean>;
  forceSave(): Promise<void>;
  clearPersisted(): Promise<void>;
}

export interface BitStoreRegistrationFeatureApi<T extends object = any> {
  cleanup(): void;

  registerField(path: string, config: BitFieldDefinition<T>): void;
  unregisterField(path: string): void;
}

export interface BitStoreArrayFeatureApi<T extends object = any> {
  pushItem<P extends BitArrayPath<T>>(
    path: P,
    value: BitArrayItem<BitPathValue<T, P>>,
  ): void;
  prependItem<P extends BitArrayPath<T>>(
    path: P,
    value: BitArrayItem<BitPathValue<T, P>>,
  ): void;
  insertItem<P extends BitArrayPath<T>>(
    path: P,
    index: number,
    value: BitArrayItem<BitPathValue<T, P>>,
  ): void;
  removeItem<P extends BitArrayPath<T>>(path: P, index: number): void;
  moveItem<P extends BitArrayPath<T>>(path: P, from: number, to: number): void;
  swapItems<P extends BitArrayPath<T>>(
    path: P,
    indexA: number,
    indexB: number,
  ): void;
}

export interface BitStoreHistoryFeatureApi {
  undo(): void;
  redo(): void;
}

export interface BitStoreFeatureApi<T extends object = any>
  extends BitStoreMaskFeatureApi,
    BitStorePersistFeatureApi,
    BitStoreRegistrationFeatureApi<T>,
    BitStoreArrayFeatureApi<T>,
    BitStoreHistoryFeatureApi {}

export interface BitStoreApi<T extends object = any>
  extends BitStoreQueryApi<T>,
    BitStoreObserveApi<T>,
    BitStoreWriteApi<T>,
    BitStoreFeatureApi<T> {}

export interface BitStoreHooksApi<T extends object = any>
  extends BitStoreApi<T> {
  getFieldState<P extends BitPath<T>>(
    path: P,
  ): Readonly<BitFieldState<T, BitPathValue<T, P>>>;
  /**
   * Subscribes to reactive state for a single field.
   * More efficient than `subscribeSelector` for per-field bindings because
   * it inlines path-scoping and equality checks without selector overhead.
   */
  subscribeFieldState<P extends BitPath<T>>(
    path: P,
    listener: (state: Readonly<BitFieldState<T, BitPathValue<T, P>>>) => void,
  ): () => void;
  /**
   * Subscribes to form-level reactive metadata (isValid, isDirty, isSubmitting).
   * Replaces the manual `subscribeSelector` + path list pattern in framework hooks.
   */
  subscribeFormMeta(listener: (meta: BitFormMeta) => void): () => void;
  subscribePath<P extends BitPath<T>>(
    path: P,
    listener: (value: BitPathValue<T, P>) => void,
    options?: BitSelectorSubscriptionOptions<BitPathValue<T, P>>,
  ): () => void;
  subscribeSelector<TSlice>(
    selector: BitSelector<T, TSlice>,
    listener: (slice: TSlice) => void,
    options?: BitSelectorSubscriptionOptions<TSlice>,
  ): () => void;
  unregisterPrefix?(prefix: string): void;
  markFieldsTouched(paths: string[]): void;
  hasValidationsInProgress(scopeFields?: string[]): boolean;
  resolveMask(path: string): BitMask | undefined;
  /** Returns a version counter that increments on every registerMask() call.
   * Used by React hooks to track mask config changes reactively. */
  getMasksVersion(): number;
  getScopeFields(scopeName: string): string[];
}

/**
 * BitFormBindingApi
 *
 * Minimal, stable contract that all framework adapters (React, Vue, Angular)
 * should type against when building hooks, composables, or injectables.
 *
 * Using this interface instead of the full `BitStoreHooksApi<T>` achieves:
 * - Reduced coupling: adapters don't depend on internal/advanced store APIs
 * - Improved testability: easily mock without providing the full store
 * - Clear documentation: makes the adapter's surface area explicit
 *
 * `BitStoreHooksApi<T>` intentionally extends this, so any `createBitStore()`
 * result is assignment-compatible with `BitFormBindingApi<T>`.
 */
export interface BitFormBindingApi<T extends object = any> {
  readonly config: Readonly<BitFrameworkConfig<T>>;

  // ── Field-level state & subscriptions ──────────────────────────────────
  getFieldState<P extends BitPath<T>>(
    path: P,
  ): Readonly<BitFieldState<T, BitPathValue<T, P>>>;
  subscribeFieldState<P extends BitPath<T>>(
    path: P,
    listener: (state: Readonly<BitFieldState<T, BitPathValue<T, P>>>) => void,
  ): () => void;

  // ── Form-level state & subscriptions ───────────────────────────────────
  getState(): Readonly<BitState<T>>;
  subscribeFormMeta(listener: (meta: BitFormMeta) => void): () => void;
  subscribe(listener: () => void): () => void;
  subscribePath<P extends BitPath<T>>(
    path: P,
    listener: (value: BitPathValue<T, P>) => void,
    options?: BitSelectorSubscriptionOptions<BitPathValue<T, P>>,
  ): () => void;
  subscribeSelector<TSlice>(
    selector: BitSelector<T, TSlice>,
    listener: (slice: TSlice) => void,
    options?: BitSelectorSubscriptionOptions<TSlice>,
  ): () => void;

  // ── Field mutations ─────────────────────────────────────────────────────
  setField<P extends BitPath<T>>(path: P, value: BitPathValue<T, P>): void;
  blurField<P extends BitPath<T>>(path: P): void;

  // ── Field registration (optional for dynamic fields) ───────────────────
  registerField?(path: string, config: BitFieldDefinition<T>): void;
  unregisterField?(path: string): void;
  unregisterPrefix?(prefix: string): void;
  markFieldsTouched(paths: string[]): void;

  // ── Mask support ────────────────────────────────────────────────────────
  resolveMask(path: string): BitMask | undefined;
  getMasksVersion(): number;

  // ── Form actions ────────────────────────────────────────────────────────
  submit(
    onSuccess: (values: T, dirtyValues?: Partial<T>) => void | Promise<void>,
  ): Promise<void>;
  reset(): void;
  validate(options?: BitValidationOptions): Promise<boolean>;
  setError(path: string, message: string | undefined): void;
  setErrors(errors: BitErrors<T>): void;
  setServerErrors(serverErrors: Record<string, string[] | string>): void;
  setValues(
    values: T | DeepPartial<T>,
    options?: { partial?: boolean; rebase?: boolean },
  ): void;
  transaction<TResult>(callback: () => TResult): TResult;

  // ── Arrays ──────────────────────────────────────────────────────────────
  pushItem<P extends BitArrayPath<T>>(
    path: P,
    value: BitArrayItem<BitPathValue<T, P>>,
  ): void;
  prependItem<P extends BitArrayPath<T>>(
    path: P,
    value: BitArrayItem<BitPathValue<T, P>>,
  ): void;
  insertItem<P extends BitArrayPath<T>>(
    path: P,
    index: number,
    value: BitArrayItem<BitPathValue<T, P>>,
  ): void;
  removeItem<P extends BitArrayPath<T>>(path: P, index: number): void;
  moveItem<P extends BitArrayPath<T>>(path: P, from: number, to: number): void;
  swapItems<P extends BitArrayPath<T>>(
    path: P,
    indexA: number,
    indexB: number,
  ): void;

  // ── History ─────────────────────────────────────────────────────────────
  undo(): void;
  redo(): void;
  getHistoryMetadata(): BitHistoryMetadata;

  // ── Persistence ─────────────────────────────────────────────────────────
  getPersistMetadata(): BitPersistMetadata;
  restorePersisted(): Promise<boolean>;
  forceSave(): Promise<void>;
  clearPersisted(): Promise<void>;

  // ── Query helpers ───────────────────────────────────────────────────────
  getDirtyValues(): Partial<T>;
  hasValidationsInProgress(scopeFields?: string[]): boolean;
  getScopeFields(scopeName: string): string[];
  getStepStatus(scopeName: string): ScopeStatus;
  getStepErrors(scopeName: string): Record<string, string>;
}
