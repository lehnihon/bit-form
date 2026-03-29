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
  BitScheduler,
  BitSubmitResult,
} from "../types";
import { BitMask } from "../../../mask/types";
import type { BitFormGlobal } from "../bus-types";
import type {
  BitSelector,
  BitScopedSelectorSubscriptionOptions,
  BitSelectorSubscriptionOptions,
} from "./subscription-types";
import type {
  BitValidationOptions,
  BitHistoryMetadata,
  BitFormMeta,
} from "./meta-types";
import type { BitValidationTriggerOptions } from "../port-types";

export interface BitStoreIdentityApi<
  T extends object = Record<string, unknown>,
> {
  readonly storeId: string;
  readonly config: Readonly<BitFrameworkConfig<T>>;
}

export interface BitFrameworkConfig<
  T extends object = Record<string, unknown>,
> extends BitConfig<T> {
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
  scheduler?: BitScheduler;
  subscriptionCacheSize?: number;
  bus?: BitFormGlobal;
  onUnhandledError: (
    error: unknown,
    source: "submit" | "validation" | "persist",
  ) => void;
}

export interface BitFormReadApi<T extends object = Record<string, unknown>> {
  getState(): Readonly<BitState<T>>;
  getFieldConfig(path: string): BitFieldDefinition<T> | undefined;
  getFieldState<P extends BitPath<T>>(
    path: P,
  ): Readonly<BitFieldState<T, BitPathValue<T, P>>>;

  isHidden<P extends BitPath<T>>(path: P): boolean;
  isRequired<P extends BitPath<T>>(path: P): boolean;
  isFieldDirty(path: string): boolean;
  isFieldValidating(path: string): boolean;
  getDirtyValues(): Partial<T>;
  getPersistMetadata(): BitPersistMetadata;
  getHistoryMetadata(): BitHistoryMetadata;
  getScopeStatus(scopeName: string): ScopeStatus;
  getScopeErrors(scopeName: string): Record<string, string>;
  getScopeFields(scopeName: string): string[];
}

export interface BitFormObserveApi<T extends object = Record<string, unknown>> {
  subscribe(listener: () => void): () => void;
  subscribePersistMeta(
    listener: (meta: BitPersistMetadata) => void,
  ): () => void;
  subscribeHistoryMeta(
    listener: (meta: BitHistoryMetadata) => void,
  ): () => void;
  subscribeScopeStatus(
    scopeName: string,
    listener: (status: ScopeStatus) => void,
  ): () => void;
}

export interface BitFormWriteApi<T extends object = Record<string, unknown>> {
  setField<P extends BitPath<T>>(path: P, value: BitPathValue<T, P>): void;
  blurField<P extends BitPath<T>>(path: P): void;
  markFieldsTouched(paths: string[]): void;
  setValues(
    values: T | DeepPartial<T>,
    options?: { partial?: boolean; rebase?: boolean },
  ): void;

  setError(path: string, message: string | undefined): void;
  setErrors(errors: BitErrors<T>): void;
  setServerErrors(serverErrors: Record<string, string[] | string>): void;

  validate(options?: BitValidationOptions): Promise<boolean>;
  triggerValidation(
    scopeFields?: string[],
    options?: BitValidationTriggerOptions,
  ): void;

  reset(): void;

  transaction<TResult>(callback: () => TResult): TResult;

  submit(
    onSuccess: (values: T, dirtyValues?: Partial<T>) => void | Promise<void>,
  ): Promise<BitSubmitResult>;
}

export interface BitStoreLifecycleApi {
  cleanup(): void;
}

export interface BitStorePersistFeatureApi {
  getPersistMetadata(): BitPersistMetadata;
  restorePersisted(): Promise<boolean>;
  forceSave(): Promise<void>;
  clearPersisted(): Promise<void>;
}

export interface BitStoreRegistrationFeatureApi<
  T extends object = Record<string, unknown>,
> {
  registerField(path: string, config: BitFieldDefinition<T>): void;
  unregisterField(path: string): void;
  unregisterPrefix(prefix: string): void;
}

export interface BitStoreArrayFeatureApi<
  T extends object = Record<string, unknown>,
> {
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
  replaceItems<P extends BitArrayPath<T>>(
    path: P,
    items: BitArrayItem<BitPathValue<T, P>>[],
  ): void;
  clearItems<P extends BitArrayPath<T>>(path: P): void;
}

export interface BitStoreHistoryFeatureApi {
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  undo(): void;
  redo(): void;
}

export interface BitStoreStateFlagsApi {
  readonly isValid: boolean;
  readonly isSubmitting: boolean;
  readonly isDirty: boolean;
}

export interface BitFormMetaBindingApi<
  T extends object = Record<string, unknown>,
> {
  getState(): Readonly<BitState<T>>;
  subscribeFormMeta(listener: (meta: BitFormMeta) => void): () => void;
}

export interface BitStoreSelectorBindingApi<
  T extends object = Record<string, unknown>,
> {
  subscribe(listener: () => void): () => void;
  subscribePath<P extends BitPath<T>>(
    path: P,
    listener: (value: BitPathValue<T, P>) => void,
    options?: BitScopedSelectorSubscriptionOptions<BitPathValue<T, P>>,
  ): () => void;
  subscribeSelector<TSlice>(
    selector: BitSelector<T, TSlice>,
    listener: (slice: TSlice) => void,
    options: BitSelectorSubscriptionOptions<TSlice>,
  ): () => void;
}

export interface BitFieldBindingApi<
  T extends object = Record<string, unknown>,
> {
  getFieldState<P extends BitPath<T>>(
    path: P,
  ): Readonly<BitFieldState<T, BitPathValue<T, P>>>;
  subscribeFieldState<P extends BitPath<T>>(
    path: P,
    listener: (state: Readonly<BitFieldState<T, BitPathValue<T, P>>>) => void,
  ): () => void;

  setField<P extends BitPath<T>>(path: P, value: BitPathValue<T, P>): void;
  blurField<P extends BitPath<T>>(path: P): void;
  resolveMask(path: string): BitMask | undefined;
  unregisterField(path: string): void;
}

export interface BitFormActionBindingApi<
  T extends object = Record<string, unknown>,
> {
  getState(): Readonly<BitState<T>>;
  setField<P extends BitPath<T>>(path: P, value: BitPathValue<T, P>): void;
  blurField<P extends BitPath<T>>(path: P): void;
  submit(
    onSuccess: (values: T, dirtyValues?: Partial<T>) => void | Promise<void>,
  ): Promise<BitSubmitResult>;
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
}

export interface BitFormControllerStoreApi<
  T extends object = Record<string, unknown>,
> {
  getState(): Readonly<BitState<T>>;
  getDirtyValues(): Partial<T>;
  submit(
    onSuccess: (values: T, dirtyValues?: Partial<T>) => void | Promise<void>,
  ): Promise<BitSubmitResult>;
  reset(): void;
  setServerErrors(serverErrors: Record<string, string[] | string>): void;
}

export interface BitFrameworkFormBindingApi<
  T extends object = Record<string, unknown>,
>
  extends
    BitFormControllerStoreApi<T>,
    Pick<
      BitFormActionBindingApi<T>,
      | "setField"
      | "blurField"
      | "setValues"
      | "setError"
      | "setErrors"
      | "validate"
      | "transaction"
    > {}

export interface BitFieldRegistrationBindingApi<
  T extends object = Record<string, unknown>,
> {
  registerField(path: string, config: BitFieldDefinition<T>): void;
  unregisterField(path: string): void;
  unregisterPrefix(prefix: string): void;
  markFieldsTouched(paths: string[]): void;
}

export interface BitDirtyTrackingBindingApi<
  T extends object = Record<string, unknown>,
> {
  getDirtyValues(): Partial<T>;
}

export interface BitArrayMutationBindingApi<
  T extends object = Record<string, unknown>,
> {
  getState(): Readonly<BitState<T>>;
  setField<P extends BitPath<T>>(path: P, value: BitPathValue<T, P>): void;
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
  replaceItems<P extends BitArrayPath<T>>(
    path: P,
    items: BitArrayItem<BitPathValue<T, P>>[],
  ): void;
  clearItems<P extends BitArrayPath<T>>(path: P): void;
  createArrayItemId(path: string, index?: number): string;
}

export interface BitArrayBindingApi<T extends object = Record<string, unknown>>
  extends
    BitArrayMutationBindingApi<T>,
    Pick<BitStoreSelectorBindingApi<T>, "subscribePath"> {}

export interface BitHistoryBindingApi {
  undo(): void;
  redo(): void;
  getHistoryMetadata(): BitHistoryMetadata;
  subscribeHistoryMeta(
    listener: (meta: BitHistoryMetadata) => void,
  ): () => void;
}

export interface BitPersistBindingApi {
  getPersistMetadata(): BitPersistMetadata;
  restorePersisted(): Promise<boolean>;
  forceSave(): Promise<void>;
  clearPersisted(): Promise<void>;
  subscribePersistMeta(
    listener: (meta: BitPersistMetadata) => void,
  ): () => void;
}

export interface BitScopeBindingApi<
  T extends object = Record<string, unknown>,
> {
  hasValidationsInProgress(scopeFields?: string[]): boolean;
  getScopeFields(scopeName: string): string[];
  getScopeStatus(scopeName: string): ScopeStatus;
  getScopeErrors(scopeName: string): Record<string, string>;
  subscribeScopeStatus(
    scopeName: string,
    listener: (status: ScopeStatus) => void,
  ): () => void;
}

export interface BitStoreFeatureApi<T extends object = Record<string, unknown>>
  extends
    BitStoreLifecycleApi,
    BitStorePersistFeatureApi,
    BitStoreRegistrationFeatureApi<T>,
    BitStoreArrayFeatureApi<T>,
    BitStoreHistoryFeatureApi {
  hasValidationsInProgress(scopeFields?: string[]): boolean;
  resolveMask(path: string): BitMask | undefined;
  createArrayItemId(path: string, index?: number): string;
}

export interface BitStoreReadSliceApi<
  T extends object = Record<string, unknown>,
>
  extends BitStoreIdentityApi<T>, BitStoreStateFlagsApi, BitFormReadApi<T> {}

export interface BitStoreObserveSliceApi<
  T extends object = Record<string, unknown>,
>
  extends
    BitFormObserveApi<T>,
    BitFormMetaBindingApi<T>,
    BitStoreSelectorBindingApi<T>,
    Pick<BitFieldBindingApi<T>, "subscribeFieldState"> {}

export interface BitStoreWriteSliceApi<
  T extends object = Record<string, unknown>,
> extends BitFormWriteApi<T> {}

export interface BitStoreNamespacesApi<
  T extends object = Record<string, unknown>,
> {
  readonly read: BitStoreReadSliceApi<T>;
  readonly observe: BitStoreObserveSliceApi<T>;
  readonly write: BitStoreWriteSliceApi<T>;
  readonly feature: BitStoreFeatureApi<T>;
}

export interface BitStoreApi<
  T extends object = Record<string, unknown>,
> extends BitStoreNamespacesApi<T> {}

export interface BitStoreHooksApi<
  T extends object = Record<string, unknown>,
> extends BitStoreApi<T> {}

export interface BitFrameworkStoreApi<
  T extends object = Record<string, unknown>,
> extends BitStoreApi<T> {}
