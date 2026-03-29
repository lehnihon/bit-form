import type {
  BitFieldDefinition,
  BitFieldState,
  BitArrayItem,
  BitArrayPath,
  BitErrors,
  BitPersistMetadata,
  BitSubmitResult,
  BitPath,
  BitPathValue,
  BitState,
  DeepPartial,
  ScopeStatus,
} from "../contracts/types";
import type {
  BitFrameworkConfig,
  BitStoreNamespacesApi,
} from "../contracts/public/store-api-types";
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
import type { BitValidationTriggerOptions } from "../contracts/port-types";
import type { BitMask } from "../../../mask/types";
import { buildStoreSlicesApi } from "./store-slices-factory";

export interface BitStoreFacadeHostPorts<T extends object> {
  readonly storeId: string;
  readonly config: Readonly<BitFrameworkConfig<T>>;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
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
  getScopeFields(scopeName: string): string[];

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
  undo(): void;
  redo(): void;
  hasValidationsInProgress(scopeFields?: string[]): boolean;
  resolveMask(path: string): BitMask | undefined;
  createArrayItemId(path: string, index?: number): string;
}

export class BitStoreNamespacesFacade<T extends object> {
  constructor(private readonly host: BitStoreFacadeHostPorts<T>) {}

  create(): BitStoreNamespacesApi<T> {
    const host = this.host;

    return buildStoreSlicesApi<T>({
      getStoreId: () => host.storeId,
      getConfig: () => host.config,
      getState: () => host.getState(),
      getFieldConfig: (path) => host.getFieldConfig(path),
      getFieldState: (path) => host.getFieldState(path),
      isHidden: (path) => host.isHidden(path),
      isRequired: (path) => host.isRequired(path),
      isFieldDirty: (path) => host.isFieldDirty(path),
      isFieldValidating: (path) => host.isFieldValidating(path),
      getDirtyValues: () => host.getDirtyValues(),
      getPersistMetadata: () => host.getPersistMetadata(),
      getHistoryMetadata: () => host.getHistoryMetadata(),
      getScopeStatus: (scopeName) => host.getScopeStatus(scopeName),
      getScopeErrors: (scopeName) => host.getScopeErrors(scopeName),
      getScopeFields: (scopeName) => host.getScopeFields(scopeName),
      subscribe: (listener) => host.subscribe(listener),
      subscribePersistMeta: (listener) => host.subscribePersistMeta(listener),
      subscribeHistoryMeta: (listener) => host.subscribeHistoryMeta(listener),
      subscribeScopeStatus: (scopeName, listener) =>
        host.subscribeScopeStatus(scopeName, listener),
      subscribeFormMeta: (listener) => host.subscribeFormMeta(listener),
      subscribeSelector: (selector, listener, options) =>
        host.subscribeSelector(selector, listener, options),
      subscribePath: (path, listener, options) =>
        host.subscribePath(path, listener, options),
      subscribeFieldState: (path, listener) =>
        host.subscribeFieldState(path, listener),
      setField: (path, value) => host.setField(path, value),
      blurField: (path) => host.blurField(path),
      markFieldsTouched: (paths) => host.markFieldsTouched(paths),
      setValues: (values, options) => host.setValues(values, options),
      setError: (path, message) => host.setError(path, message),
      setErrors: (errors) => host.setErrors(errors),
      setServerErrors: (serverErrors) => host.setServerErrors(serverErrors),
      validate: (options) => host.validate(options),
      triggerValidation: (scopeFields, options) =>
        host.triggerValidation(scopeFields, options),
      reset: () => host.reset(),
      transaction: (callback) => host.transaction(callback),
      submit: (onSuccess) => host.submit(onSuccess),
      cleanup: () => host.cleanup(),
      restorePersisted: () => host.restorePersisted(),
      forceSave: () => host.forceSave(),
      clearPersisted: () => host.clearPersisted(),
      registerField: (path, config) => host.registerField(path, config),
      unregisterField: (path) => host.unregisterField(path),
      unregisterPrefix: (prefix) => host.unregisterPrefix(prefix),
      pushItem: (path, value) => host.pushItem(path, value),
      prependItem: (path, value) => host.prependItem(path, value),
      insertItem: (path, index, value) => host.insertItem(path, index, value),
      removeItem: (path, index) => host.removeItem(path, index),
      moveItem: (path, from, to) => host.moveItem(path, from, to),
      swapItems: (path, indexA, indexB) => host.swapItems(path, indexA, indexB),
      replaceItems: (path, items) => host.replaceItems(path, items),
      clearItems: (path) => host.clearItems(path),
      getCanUndo: () => host.canUndo,
      getCanRedo: () => host.canRedo,
      undo: () => host.undo(),
      redo: () => host.redo(),
      hasValidationsInProgress: (scopeFields) =>
        host.hasValidationsInProgress(scopeFields),
      resolveMask: (path) => host.resolveMask(path),
      createArrayItemId: (path, index) => host.createArrayItemId(path, index),
    });
  }
}

export function createStoreNamespacesFromFacadeHost<T extends object>(
  host: BitStoreFacadeHostPorts<T>,
) {
  return new BitStoreNamespacesFacade(host).create();
}
