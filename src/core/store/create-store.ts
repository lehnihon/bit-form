import { BitStore } from "./index";
import { BitConfig } from "./types";
import { BitStoreApi, BitStoreHooksApi } from "./public-types";

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

  return store as unknown as BitStoreHooksApi<T>;
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
    subscribe: engine.subscribe.bind(engine),

    setField: engine.setField.bind(engine),
    blurField: engine.blurField.bind(engine),
    replaceValues: engine.replaceValues.bind(engine),
    hydrate: engine.hydrate.bind(engine),
    rebase: engine.rebase.bind(engine),

    setError: engine.setError.bind(engine),
    setErrors: engine.setErrors.bind(engine),
    setServerErrors: engine.setServerErrors.bind(engine),

    validate: engine.validate.bind(engine),
    reset: engine.reset.bind(engine),
    submit: engine.submit.bind(engine),

    registerMask: engine.registerMask.bind(engine),
    getDirtyValues: engine.getDirtyValues.bind(engine),
    restorePersisted: engine.restorePersisted.bind(engine),
    forceSave: engine.forceSave.bind(engine),
    clearPersisted: engine.clearPersisted.bind(engine),

    registerField: engine.registerField.bind(engine),
    unregisterField: engine.unregisterField.bind(engine),

    isHidden: engine.isHidden.bind(engine),
    isRequired: engine.isRequired.bind(engine),
    isFieldDirty: engine.isFieldDirty.bind(engine),
    isFieldValidating: engine.isFieldValidating.bind(engine),
    watch: engine.watch.bind(engine),

    pushItem: engine.pushItem.bind(engine),
    prependItem: engine.prependItem.bind(engine),
    insertItem: engine.insertItem.bind(engine),
    removeItem: engine.removeItem.bind(engine),
    moveItem: engine.moveItem.bind(engine),
    swapItems: engine.swapItems.bind(engine),

    getHistoryMetadata: engine.getHistoryMetadata.bind(engine),
    undo: engine.undo.bind(engine),
    redo: engine.redo.bind(engine),

    getStepStatus: engine.getStepStatus.bind(engine),
    getStepErrors: engine.getStepErrors.bind(engine),

    cleanup: engine.cleanup.bind(engine),
  };

  Object.defineProperty(facade, BIT_STORE_ENGINE, {
    value: engine,
    enumerable: false,
    configurable: false,
    writable: false,
  });

  return facade;
}
