import type {
  BitFieldDefinition,
  BitFieldState,
  BitPath,
  BitPathValue,
} from "../contracts/types";
import type {
  BitFrameworkConfig,
  BitStoreHooksApi,
} from "../contracts/public/store-api-types";
import { buildStoreSlicesApi } from "./store-slices-factory";

type BitStoreFacadeHost<T extends object> = BitStoreHooksApi<T> & {
  readonly storeId: string;
  readonly config: Readonly<BitFrameworkConfig<T>>;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  getFieldConfig(path: string): BitFieldDefinition<T> | undefined;
  getFieldState<P extends BitPath<T>>(
    path: P,
  ): BitFieldState<T, BitPathValue<T, P>>;
};

export function createStoreNamespacesFromFacadeHost<T extends object>(
  host: BitStoreFacadeHost<T>,
) {
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
  });
}
