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
} from "../types";
import { BitMask, BitMaskName } from "../../../mask/types";
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
  T extends object = any,
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
  extends
    BitStoreMaskFeatureApi,
    BitStorePersistFeatureApi,
    BitStoreRegistrationFeatureApi<T>,
    BitStoreArrayFeatureApi<T>,
    BitStoreHistoryFeatureApi {}

export interface BitStoreApi<T extends object = any>
  extends
    BitStoreQueryApi<T>,
    BitStoreObserveApi<T>,
    BitStoreWriteApi<T>,
    BitStoreFeatureApi<T> {}

export interface BitStoreHooksApi<
  T extends object = any,
> extends BitStoreApi<T> {
  getFieldState<P extends BitPath<T>>(
    path: P,
  ): Readonly<BitFieldState<T, BitPathValue<T, P>>>;
  subscribeFieldState<P extends BitPath<T>>(
    path: P,
    listener: (state: Readonly<BitFieldState<T, BitPathValue<T, P>>>) => void,
  ): () => void;
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
  subscribeTracked<TSlice>(
    selector: BitSelector<T, TSlice>,
    listener: (slice: TSlice) => void,
    options?: Omit<BitSelectorSubscriptionOptions<TSlice>, "paths">,
  ): () => void;
  unregisterPrefix?(prefix: string): void;
  markFieldsTouched(paths: string[]): void;
  hasValidationsInProgress(scopeFields?: string[]): boolean;
  resolveMask(path: string): BitMask | undefined;
  getMasksVersion(): number;
  getScopeFields(scopeName: string): string[];
}

export interface BitFormBindingApi<T extends object = any> {
  readonly config: Readonly<BitFrameworkConfig<T>>;

  getFieldState<P extends BitPath<T>>(
    path: P,
  ): Readonly<BitFieldState<T, BitPathValue<T, P>>>;
  subscribeFieldState<P extends BitPath<T>>(
    path: P,
    listener: (state: Readonly<BitFieldState<T, BitPathValue<T, P>>>) => void,
  ): () => void;

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
  subscribeTracked<TSlice>(
    selector: BitSelector<T, TSlice>,
    listener: (slice: TSlice) => void,
    options?: Omit<BitSelectorSubscriptionOptions<TSlice>, "paths">,
  ): () => void;

  setField<P extends BitPath<T>>(path: P, value: BitPathValue<T, P>): void;
  blurField<P extends BitPath<T>>(path: P): void;

  registerField?(path: string, config: BitFieldDefinition<T>): void;
  unregisterField?(path: string): void;
  unregisterPrefix?(prefix: string): void;
  markFieldsTouched(paths: string[]): void;

  resolveMask(path: string): BitMask | undefined;
  getMasksVersion(): number;

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

  undo(): void;
  redo(): void;
  getHistoryMetadata(): BitHistoryMetadata;

  getPersistMetadata(): BitPersistMetadata;
  restorePersisted(): Promise<boolean>;
  forceSave(): Promise<void>;
  clearPersisted(): Promise<void>;

  getDirtyValues(): Partial<T>;
  hasValidationsInProgress(scopeFields?: string[]): boolean;
  getScopeFields(scopeName: string): string[];
  getStepStatus(scopeName: string): ScopeStatus;
  getStepErrors(scopeName: string): Record<string, string>;
}
