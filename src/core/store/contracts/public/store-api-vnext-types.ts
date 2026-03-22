import type {
  BitArrayPath,
  BitArrayItem,
  BitErrors,
  BitFieldDefinition,
  BitFieldState,
  BitPath,
  BitPathValue,
  BitPersistMetadata,
  BitState,
  DeepPartial,
  ScopeStatus,
} from "../types";
import type { BitMask, BitMaskName } from "../../../mask/types";
import type {
  BitFormMeta,
  BitHistoryMetadata,
  BitValidationOptions,
} from "./meta-types";
import type {
  BitSelector,
  BitSelectorSubscriptionOptions,
} from "./subscription-types";
import type { BitFrameworkConfig } from "./store-api-types";

export interface BitStoreQueryVNextApi<T extends object = any> {
  getState(): Readonly<BitState<T>>;
  getDirtyValues(): Partial<T>;
  getPersistMetadata(): BitPersistMetadata;
  getHistoryMetadata(): BitHistoryMetadata;
  getStepStatus(scopeName: string): ScopeStatus;
  getStepErrors(scopeName: string): Record<string, string>;
  isHidden<P extends BitPath<T>>(path: P): boolean;
  isRequired<P extends BitPath<T>>(path: P): boolean;
  isFieldDirty(path: string): boolean;
  isFieldValidating(path: string): boolean;
  getFieldState<P extends BitPath<T>>(
    path: P,
  ): Readonly<BitFieldState<T, BitPathValue<T, P>>>;
}

export interface BitStoreWriteVNextApi<T extends object = any> {
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

export interface BitStoreObserveVNextApi<T extends object = any> {
  subscribe(listener: () => void): () => void;
  subscribeFormMeta(listener: (meta: BitFormMeta) => void): () => void;
  subscribeFieldState<P extends BitPath<T>>(
    path: P,
    listener: (state: Readonly<BitFieldState<T, BitPathValue<T, P>>>) => void,
  ): () => void;
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

export interface BitStoreFeaturesVNextApi<T extends object = any> {
  registerField(path: string, config: BitFieldDefinition<T>): void;
  unregisterField(path: string): void;
  unregisterPrefix(prefix: string): void;
  markFieldsTouched(paths: string[]): void;
  registerMask(name: BitMaskName, mask: BitMask): void;
  unregisterMask(name: BitMaskName): void;
  getMasksVersion(): number;
  resolveMask(path: string): BitMask | undefined;
  hasValidationsInProgress(scopeFields?: string[]): boolean;
  getScopeFields(scopeName: string): string[];
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
  restorePersisted(): Promise<boolean>;
  forceSave(): Promise<void>;
  clearPersisted(): Promise<void>;
  cleanup(): void;
}

export interface BitStoreVNextApi<T extends object = any> {
  readonly config: Readonly<BitFrameworkConfig<T>>;
  readonly query: BitStoreQueryVNextApi<T>;
  readonly write: BitStoreWriteVNextApi<T>;
  readonly observe: BitStoreObserveVNextApi<T>;
  readonly features: BitStoreFeaturesVNextApi<T>;
}
