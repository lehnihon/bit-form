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
} from "./types";
import { BitMask } from "../mask/types";

export type BitSelector<T extends object, TSlice> = (
  state: Readonly<BitState<T>>,
) => TSlice;

export type BitEqualityFn<TValue> = (previous: TValue, next: TValue) => boolean;

export interface BitSelectorSubscriptionOptions<TValue> {
  equalityFn?: BitEqualityFn<TValue>;
  emitImmediately?: boolean;
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

export interface BitPersistMetadata {
  isSaving: boolean;
  isRestoring: boolean;
  error: Error | null;
}

export interface BitFrameworkConfig<
  T extends object = any,
> extends BitConfig<T> {
  initialValues: T;
  resolver?: ValidatorFn<T>;
  validationDelay: number;
  enableHistory: boolean;
  historyLimit: number;
  masks?: Record<string, BitMask>;
  fields?: Record<string, BitFieldDefinition<T>>;
  devTools?: boolean | DevToolsOptions;
  persist: BitPersistResolvedConfig<T>;
  plugins: BitPlugin<T>[];
}

export interface BitStoreApi<T extends object = any> {
  readonly config: Readonly<BitFrameworkConfig<T>>;

  getConfig(): Readonly<BitFrameworkConfig<T>>;
  getState(): Readonly<BitState<T>>;

  subscribe(listener: () => void): () => void;

  setField<P extends BitPath<T>>(path: P, value: BitPathValue<T, P>): void;
  blurField<P extends BitPath<T>>(path: P): void;
  replaceValues(values: T): void;
  hydrate(values: DeepPartial<T>): void;
  rebase(values: T): void;

  setError(path: string, message: string | undefined): void;
  setErrors(errors: BitErrors<T>): void;
  setServerErrors(serverErrors: Record<string, string[] | string>): void;

  validate(options?: BitValidationOptions): Promise<boolean>;

  reset(): void;

  submit(
    onSuccess: (values: T, dirtyValues?: Partial<T>) => void | Promise<void>,
  ): Promise<void>;

  registerMask(name: string, mask: BitMask): void;
  getDirtyValues(): Partial<T>;
  restorePersisted(): Promise<boolean>;
  forceSave(): Promise<void>;
  clearPersisted(): Promise<void>;

  cleanup(): void;

  registerField(path: string, config: BitFieldDefinition<T>): void;
  unregisterField(path: string): void;

  isHidden<P extends BitPath<T>>(path: P): boolean;
  isRequired<P extends BitPath<T>>(path: P): boolean;
  isFieldDirty(path: string): boolean;
  isFieldValidating(path: string): boolean;

  watch<P extends BitPath<T>>(
    path: P,
    callback: (value: BitPathValue<T, P>) => void,
  ): () => void;

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

  getHistoryMetadata(): BitHistoryMetadata;
  undo(): void;
  redo(): void;

  getStepStatus(scopeName: string): ScopeStatus;
  getStepErrors(scopeName: string): Record<string, string>;
}

export interface BitStoreHooksApi<
  T extends object = any,
> extends BitStoreApi<T> {
  getFieldState<P extends BitPath<T>>(
    path: P,
  ): Readonly<BitFieldState<T, BitPathValue<T, P>>>;
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
  getScopeFields(scopeName: string): string[];
}
