import {
  BitErrors,
  BitFieldState,
  BitFieldDefinition,
  BitPath,
  BitPathValue,
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
  getFieldState<P extends BitPath<T>>(
    path: P,
  ): Readonly<BitFieldState<T, BitPathValue<T, P>>>;

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

  setField<P extends BitPath<T>>(path: P, value: BitPathValue<T, P>): void;
  blurField<P extends BitPath<T>>(path: P): void;
  replaceValues(values: T): void;
  hydrate(values: DeepPartial<T>): void;
  rebase(values: T): void;
  setValues(values: T): void;

  setError(path: string, message: string | undefined): void;
  setErrors(errors: BitErrors<T>): void;
  setServerErrors(serverErrors: Record<string, string[] | string>): void;

  validate(options?: {
    scope?: string;
    scopeFields?: string[];
  }): Promise<boolean>;

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
  unregisterPrefix?(prefix: string): void;

  isHidden(path: any): boolean;
  isRequired(path: any): boolean;
  isFieldDirty(path: string): boolean;
  isFieldValidating(path: string): boolean;

  watch(path: any, callback: (value: any) => void): () => void;

  pushItem(path: any, value: any): void;
  prependItem(path: any, value: any): void;
  insertItem(path: any, index: number, value: any): void;
  removeItem(path: any, index: number): void;
  moveItem(path: any, from: number, to: number): void;
  swapItems(path: any, indexA: number, indexB: number): void;

  getHistoryMetadata(): {
    canUndo: boolean;
    canRedo: boolean;
    historyIndex: number;
    historySize: number;
  };
  undo(): void;
  redo(): void;

  getStepStatus(scopeName: string): ScopeStatus;
  getStepErrors(scopeName: string): Record<string, string>;
  markFieldsTouched(paths: string[]): void;
  hasValidationsInProgress(scopeFields?: string[]): boolean;

  beginFieldValidation(path: string): void;
  endFieldValidation(path: string): void;
  setFieldAsyncError(path: string, message: string): Promise<void>;
  clearFieldAsyncError(path: string): Promise<void>;
  resolveMask(path: string): BitMask | undefined;
  getScopeFields(scopeName: string): string[];
}

export interface BitPublicStore<
  T extends object = any,
> extends BitStoreApi<T> {}

export interface BitFrameworkStore<
  T extends object = any,
> extends BitStoreApi<T> {}
