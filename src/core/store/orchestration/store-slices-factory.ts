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
  BitStoreIdentityApi,
  BitFrameworkConfig,
  BitStoreReadSliceApi,
  BitStoreObserveSliceApi,
  BitStoreWriteSliceApi,
  BitStoreFeatureApi,
  BitStoreNamespacesApi,
} from "../contracts/public/store-api-types";
import type { BitValidationTriggerOptions } from "../contracts/port-types";
import type {
  BitStoreFeatureDomain,
  BitStoreObserveDomain,
  BitStoreReadDomain,
  BitStoreWriteDomain,
} from "./store-domains";
import type { BitMask } from "../../mask/types";

export interface BitStoreSlicesFactoryDeps<
  T extends object = Record<string, unknown>,
> {
  identity: BitStoreIdentityApi<T>;
  read: BitStoreReadDomain<T>;
  observe: BitStoreObserveDomain<T>;
  write: BitStoreWriteDomain<T>;
  feature: BitStoreFeatureDomain<T>;
  getFieldConfig(path: string): BitFieldDefinition<T> | undefined;
  resolveMask(path: string): BitMask | undefined;
  createArrayItemId(path: string, index?: number): string;
}

export function buildStoreSlicesApi<T extends object>(
  deps: BitStoreSlicesFactoryDeps<T>,
): BitStoreNamespacesApi<T> {
  const readState = () => deps.read.getState();

  const read: BitStoreReadSliceApi<T> = {
    get storeId() {
      return deps.identity.storeId;
    },
    get config() {
      return deps.identity.config;
    },
    get isValid() {
      return deps.read.getIsValid();
    },
    get isSubmitting() {
      return deps.read.getIsSubmitting();
    },
    get isDirty() {
      return deps.read.getIsDirty();
    },
    getState: readState,
    getFieldConfig: (path) => deps.getFieldConfig(path),
    getFieldState: (path) => deps.read.getFieldState(path),
    isHidden: (path) => deps.read.isHidden(path),
    isRequired: (path) => deps.read.isRequired(path),
    isFieldDirty: (path) => deps.read.isFieldDirty(path),
    isFieldValidating: (path) => deps.read.isFieldValidating(path),
    getDirtyValues: () => deps.read.getDirtyValues(),
    getPersistMetadata: () => deps.read.getPersistMetadata(),
    getHistoryMetadata: () => deps.read.getHistoryMetadata(),
    getScopeStatus: (scopeName) => deps.read.getScopeStatus(scopeName),
    getScopeErrors: (scopeName) => deps.read.getScopeErrors(scopeName),
    getScopeFields: (scopeName) => deps.read.getScopeFields(scopeName),
  };

  const observe: BitStoreObserveSliceApi<T> = {
    getState: readState,
    subscribe: (listener) => deps.observe.subscribe(listener),
    subscribePersistMeta: (listener) =>
      deps.observe.subscribePersistMeta(listener),
    subscribeHistoryMeta: (listener) =>
      deps.observe.subscribeHistoryMeta(listener),
    subscribeScopeStatus: (scopeName, listener) =>
      deps.observe.subscribeScopeStatus(scopeName, listener),
    subscribeFormMeta: (listener) => deps.observe.subscribeFormMeta(listener),
    subscribeSelector: (selector, listener, options) =>
      deps.observe.subscribeSelector(selector, listener, options),
    subscribePath: (path, listener, options) =>
      deps.observe.subscribePath(path, listener, options),
    subscribeFieldState: (path, listener) =>
      deps.observe.subscribeFieldState(path, listener),
  };

  const write: BitStoreWriteSliceApi<T> = {
    setField: (path, value) => deps.write.setField(path, value),
    blurField: (path) => deps.write.blurField(path),
    markFieldsTouched: (paths) => deps.write.markFieldsTouched(paths),
    setValues: (values, options) => deps.write.setValues(values, options),
    setError: (path, message) => deps.write.setError(path, message),
    setErrors: (errors) => deps.write.setErrors(errors),
    setServerErrors: (serverErrors) => deps.write.setServerErrors(serverErrors),
    validate: (options) => deps.feature.validate(options),
    triggerValidation: (scopeFields, options) =>
      deps.feature.triggerValidation(scopeFields, options),
    reset: () => deps.write.reset(),
    transaction: (callback) => deps.write.transaction(callback),
    submit: (onSuccess) => deps.write.submit(onSuccess),
  };

  const feature: BitStoreFeatureApi<T> = {
    cleanup: () => deps.feature.cleanup(),
    getPersistMetadata: () => deps.read.getPersistMetadata(),
    restorePersisted: () => deps.feature.restorePersisted(),
    forceSave: () => deps.feature.forceSave(),
    clearPersisted: () => deps.feature.clearPersisted(),
    registerField: (path, config) => deps.write.registerField(path, config),
    unregisterField: (path) => deps.write.unregisterField(path),
    unregisterPrefix: (prefix) => deps.write.unregisterPrefix(prefix),
    pushItem: (path, value) => deps.write.pushItem(path, value),
    prependItem: (path, value) => deps.write.prependItem(path, value),
    insertItem: (path, index, value) =>
      deps.write.insertItem(path, index, value),
    removeItem: (path, index) => deps.write.removeItem(path, index),
    moveItem: (path, from, to) => deps.write.moveItem(path, from, to),
    swapItems: (path, indexA, indexB) =>
      deps.write.swapItems(path, indexA, indexB),
    replaceItems: (path, items) => deps.write.replaceItems(path, items),
    clearItems: (path) => deps.write.clearItems(path),
    get canUndo() {
      return deps.read.getCanUndo();
    },
    get canRedo() {
      return deps.read.getCanRedo();
    },
    hasValidationsInProgress: (scopeFields) =>
      deps.feature.hasValidationsInProgress(scopeFields),
    resolveMask: (path) => deps.resolveMask(path),
    createArrayItemId: (path, index) => deps.createArrayItemId(path, index),
    undo: () => deps.feature.undo(),
    redo: () => deps.feature.redo(),
  };

  return {
    read,
    observe,
    write,
    feature,
  };
}
