import { BitStore } from "../index";
import { BitConfig } from "../contracts/types";
import { BitStoreApi, BitStoreHooksApi } from "../contracts/public-types";

const BIT_STORE_ENGINE = Symbol.for("bit-form.store.engine");

type BitStoreFacade<T extends object> = BitStoreApi<T> & {
  [BIT_STORE_ENGINE]?: BitStore<T>;
};

export function resolveBitStoreForHooks<T extends object>(
  store: BitStoreApi<T> | BitStore<T>,
): BitStoreHooksApi<T> {
  if (store instanceof BitStore) {
    return store;
  }

  const facade = store as BitStoreFacade<T>;
  if (facade[BIT_STORE_ENGINE]) {
    return facade[BIT_STORE_ENGINE] as BitStoreHooksApi<T>;
  }

  throw new Error(
    "BitStore: store facade without engine reference cannot be resolved for hooks API.",
  );
}

export function createBitStore<T extends object = any>(
  config: BitConfig<T> = {},
): BitStoreApi<T> {
  const engine = new BitStore<T>(config);

  const facade: BitStoreFacade<T> = {
    get config() {
      return engine.config;
    },
    getConfig: () => engine.getConfig(),
    getState: () => engine.getState(),
    subscribe: (listener) => engine.subscribe(listener),
    setField: (path, value) => engine.setField(path, value),
    blurField: (path) => engine.blurField(path),
    replaceValues: (values) => engine.replaceValues(values),
    hydrate: (values) => engine.hydrate(values),
    rebase: (values) => engine.rebase(values),
    setError: (path, message) => engine.setError(path, message),
    setErrors: (errors) => engine.setErrors(errors),
    setServerErrors: (serverErrors) => engine.setServerErrors(serverErrors),
    validate: (options) => engine.validate(options),
    reset: () => engine.reset(),
    submit: (onSuccess) => engine.submit(onSuccess),
    registerMask: (name, mask) => engine.registerMask(name, mask),
    getDirtyValues: () => engine.getDirtyValues(),
    getPersistMetadata: () => engine.getPersistMetadata(),
    restorePersisted: () => engine.restorePersisted(),
    forceSave: () => engine.forceSave(),
    clearPersisted: () => engine.clearPersisted(),
    cleanup: () => engine.cleanup(),
    registerField: (path, cfg) => engine.registerField(path, cfg),
    unregisterField: (path) => engine.unregisterField(path),
    isHidden: (path) => engine.isHidden(path),
    isRequired: (path) => engine.isRequired(path),
    isFieldDirty: (path) => engine.isFieldDirty(path),
    isFieldValidating: (path) => engine.isFieldValidating(path),
    watch: (path, callback) => engine.watch(path, callback),
    pushItem: (path, value) => engine.pushItem(path, value),
    prependItem: (path, value) => engine.prependItem(path, value),
    insertItem: (path, index, value) => engine.insertItem(path, index, value),
    removeItem: (path, index) => engine.removeItem(path, index),
    moveItem: (path, from, to) => engine.moveItem(path, from, to),
    swapItems: (path, indexA, indexB) => engine.swapItems(path, indexA, indexB),
    getHistoryMetadata: () => engine.getHistoryMetadata(),
    undo: () => engine.undo(),
    redo: () => engine.redo(),
    getStepStatus: (scopeName) => engine.getStepStatus(scopeName),
    getStepErrors: (scopeName) => engine.getStepErrors(scopeName),
    [BIT_STORE_ENGINE]: engine,
  };

  return facade;
}
