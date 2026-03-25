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
  BitSelectorSubscriptionOptions,
} from "./subscription-types";
import type {
  BitValidationOptions,
  BitHistoryMetadata,
  BitFormMeta,
} from "./meta-types";

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
}

export interface BitFormReadApi<T extends object = Record<string, unknown>> {
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
  undo(): void;
  redo(): void;
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
    options?: BitSelectorSubscriptionOptions<BitPathValue<T, P>>,
  ): () => void;
  subscribeSelector<TSlice>(
    selector: BitSelector<T, TSlice>,
    listener: (slice: TSlice) => void,
    options?: BitSelectorSubscriptionOptions<TSlice>,
  ): () => void;
  subscribeTracked<TSlice>(
    selector: BitSelector<T, TSlice>,
    listener: (slice: TSlice) => void,
    options?: Omit<BitSelectorSubscriptionOptions<TSlice>, "paths">,
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
  getStepStatus(scopeName: string): ScopeStatus;
  getStepErrors(scopeName: string): Record<string, string>;
  subscribeScopeStatus(
    scopeName: string,
    listener: (status: ScopeStatus) => void,
  ): () => void;
}

export interface BitFrameworkStoreApi<
  T extends object = Record<string, unknown>,
>
  extends
    BitFieldBindingApi<T>,
    BitFormMetaBindingApi<T>,
    BitStoreSelectorBindingApi<T>,
    BitFormActionBindingApi<T>,
    BitFieldRegistrationBindingApi<T>,
    BitDirtyTrackingBindingApi<T>,
    BitArrayMutationBindingApi<T>,
    BitHistoryBindingApi,
    BitPersistBindingApi,
    BitScopeBindingApi<T> {}

export interface BitStoreFeatureApi<T extends object = Record<string, unknown>>
  extends
    BitStoreLifecycleApi,
    BitStorePersistFeatureApi,
    BitStoreRegistrationFeatureApi<T>,
    BitStoreArrayFeatureApi<T>,
    BitStoreHistoryFeatureApi {}

export interface BitStoreCapabilityApi<
  T extends object = Record<string, unknown>,
>
  extends
    BitFormReadApi<T>,
    BitFormObserveApi<T>,
    BitFormWriteApi<T>,
    BitStoreFeatureApi<T> {}

export interface BitStoreApi<
  T extends object = Record<string, unknown>,
> extends BitStoreCapabilityApi<T> {}

export interface BitStoreHooksApi<T extends object = Record<string, unknown>>
  extends
    BitStoreApi<T>,
    BitFieldBindingApi<T>,
    BitFormMetaBindingApi<T>,
    BitStoreSelectorBindingApi<T>,
    BitFieldRegistrationBindingApi<T>,
    BitScopeBindingApi<T> {
  resolveMask(path: string): BitMask | undefined;
  createArrayItemId(path: string, index?: number): string;
}
