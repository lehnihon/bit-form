import type {
  BitState,
  BitArrayItem,
  BitArrayPath,
  BitErrors,
  BitFieldDefinition,
  BitFieldState,
  BitPath,
  BitPathValue,
  BitPersistMetadata,
  BitSubmitResult,
  DeepPartial,
  ScopeStatus,
} from "../contracts/types";
import type {
  BitFormMeta,
  BitHistoryMetadata,
  BitValidationOptions,
} from "../contracts/public/meta-types";
import type {
  BitSelector,
  BitScopedSelectorSubscriptionOptions,
  BitSelectorSubscriptionOptions,
} from "../contracts/public/subscription-types";
import type {
  BitFrameworkConfig,
  BitStoreReadSliceApi,
  BitStoreObserveSliceApi,
  BitStoreWriteSliceApi,
  BitStoreFeatureApi,
  BitStoreNamespacesApi,
} from "../contracts/public/store-api-types";
import type { BitValidationTriggerOptions } from "../contracts/port-types";

export interface BitStoreSlicesFactoryDeps<
  T extends object = Record<string, unknown>,
> {
  getStoreId(): string;
  getConfig(): Readonly<BitFrameworkConfig<T>>;
  getState(): Readonly<BitState<T>>;
  getFieldConfig(path: string): BitFieldDefinition<T> | undefined;
  getFieldState<P extends BitPath<T>>(
    path: P,
  ): BitFieldState<T, BitPathValue<T, P>>;
  isHidden<P extends BitPath<T>>(path: P): boolean;
  isRequired<P extends BitPath<T>>(path: P): boolean;
  isFieldDirty(path: string): boolean;
  isFieldValidating(path: string): boolean;
  getDirtyValues(): Partial<T>;
  getPersistMetadata(): BitPersistMetadata;
  getHistoryMetadata(): BitHistoryMetadata;
  getScopeStatus(scopeName: string): ScopeStatus;
  getScopeErrors(scopeName: string): Record<string, string>;

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
  subscribeFormMeta(listener: (meta: BitFormMeta) => void): () => void;
  subscribeSelector<TSlice>(
    selector: BitSelector<T, TSlice>,
    listener: (slice: TSlice) => void,
    options?: BitSelectorSubscriptionOptions<TSlice>,
  ): () => void;
  subscribePath<P extends BitPath<T>>(
    path: P,
    listener: (value: BitPathValue<T, P>) => void,
    options?: BitScopedSelectorSubscriptionOptions<BitPathValue<T, P>>,
  ): () => void;
  subscribeFieldState<P extends BitPath<T>>(
    path: P,
    listener: (state: Readonly<BitFieldState<T, BitPathValue<T, P>>>) => void,
  ): () => void;

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

  cleanup(): void;
  restorePersisted(): Promise<boolean>;
  forceSave(): Promise<void>;
  clearPersisted(): Promise<void>;
  registerField(path: string, config: BitFieldDefinition<T>): void;
  unregisterField(path: string): void;
  unregisterPrefix(prefix: string): void;
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
  getCanUndo(): boolean;
  getCanRedo(): boolean;
  undo(): void;
  redo(): void;
}

export function buildStoreSlicesApi<T extends object>(
  deps: BitStoreSlicesFactoryDeps<T>,
): BitStoreNamespacesApi<T> {
  const readState = () => deps.getState();

  const read: BitStoreReadSliceApi<T> = {
    get storeId() {
      return deps.getStoreId();
    },
    get config() {
      return deps.getConfig();
    },
    get isValid() {
      return readState().isValid;
    },
    get isSubmitting() {
      return readState().isSubmitting;
    },
    get isDirty() {
      return readState().isDirty;
    },
    getConfig: () => deps.getConfig(),
    getState: readState,
    getFieldConfig: (path) => deps.getFieldConfig(path),
    getFieldState: (path) => deps.getFieldState(path),
    isHidden: (path) => deps.isHidden(path),
    isRequired: (path) => deps.isRequired(path),
    isFieldDirty: (path) => deps.isFieldDirty(path),
    isFieldValidating: (path) => deps.isFieldValidating(path),
    getDirtyValues: () => deps.getDirtyValues(),
    getPersistMetadata: () => deps.getPersistMetadata(),
    getHistoryMetadata: () => deps.getHistoryMetadata(),
    getScopeStatus: (scopeName) => deps.getScopeStatus(scopeName),
    getScopeErrors: (scopeName) => deps.getScopeErrors(scopeName),
  };

  const observe: BitStoreObserveSliceApi<T> = {
    getState: readState,
    subscribe: (listener) => deps.subscribe(listener),
    subscribePersistMeta: (listener) => deps.subscribePersistMeta(listener),
    subscribeHistoryMeta: (listener) => deps.subscribeHistoryMeta(listener),
    subscribeScopeStatus: (scopeName, listener) =>
      deps.subscribeScopeStatus(scopeName, listener),
    subscribeFormMeta: (listener) => deps.subscribeFormMeta(listener),
    subscribeSelector: (selector, listener, options) =>
      deps.subscribeSelector(selector, listener, options),
    subscribePath: (path, listener, options) =>
      deps.subscribePath(path, listener, options),
    subscribeFieldState: (path, listener) =>
      deps.subscribeFieldState(path, listener),
  };

  const write: BitStoreWriteSliceApi<T> = {
    setField: (path, value) => deps.setField(path, value),
    blurField: (path) => deps.blurField(path),
    markFieldsTouched: (paths) => deps.markFieldsTouched(paths),
    setValues: (values, options) => deps.setValues(values, options),
    setError: (path, message) => deps.setError(path, message),
    setErrors: (errors) => deps.setErrors(errors),
    setServerErrors: (serverErrors) => deps.setServerErrors(serverErrors),
    validate: (options) => deps.validate(options),
    triggerValidation: (scopeFields, options) =>
      deps.triggerValidation(scopeFields, options),
    reset: () => deps.reset(),
    transaction: (callback) => deps.transaction(callback),
    submit: (onSuccess) => deps.submit(onSuccess),
  };

  const feature: BitStoreFeatureApi<T> = {
    cleanup: () => deps.cleanup(),
    getPersistMetadata: () => deps.getPersistMetadata(),
    restorePersisted: () => deps.restorePersisted(),
    forceSave: () => deps.forceSave(),
    clearPersisted: () => deps.clearPersisted(),
    registerField: (path, config) => deps.registerField(path, config),
    unregisterField: (path) => deps.unregisterField(path),
    unregisterPrefix: (prefix) => deps.unregisterPrefix(prefix),
    pushItem: (path, value) => deps.pushItem(path, value),
    prependItem: (path, value) => deps.prependItem(path, value),
    insertItem: (path, index, value) => deps.insertItem(path, index, value),
    removeItem: (path, index) => deps.removeItem(path, index),
    moveItem: (path, from, to) => deps.moveItem(path, from, to),
    swapItems: (path, indexA, indexB) => deps.swapItems(path, indexA, indexB),
    replaceItems: (path, items) => deps.replaceItems(path, items),
    clearItems: (path) => deps.clearItems(path),
    get canUndo() {
      return deps.getCanUndo();
    },
    get canRedo() {
      return deps.getCanRedo();
    },
    undo: () => deps.undo(),
    redo: () => deps.redo(),
  };

  return {
    read,
    observe,
    write,
    feature,
  };
}
