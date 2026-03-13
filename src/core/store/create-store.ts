import { BitStore } from "./index";
import { BitConfig } from "./types";
import { BitStoreApi } from "./public-types";

export function createBitStore<T extends object = any>(
  config: BitConfig<T> = {},
): BitStoreApi<T> {
  const engine = new BitStore<T>(config);

  return {
    get config() {
      return engine.config;
    },

    getConfig: () => engine.getConfig(),
    getState: () => engine.getState(),
    getFieldState: engine.getFieldState.bind(engine),
    subscribe: engine.subscribe.bind(engine),
    subscribePath: engine.subscribePath.bind(engine),
    subscribeSelector: engine.subscribeSelector.bind(engine),

    setField: engine.setField.bind(engine),
    blurField: engine.blurField.bind(engine),
    replaceValues: engine.replaceValues.bind(engine),
    hydrate: engine.hydrate.bind(engine),
    rebase: engine.rebase.bind(engine),
    setValues: engine.setValues.bind(engine),

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
    unregisterPrefix: engine.unregisterPrefix.bind(engine),

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
    markFieldsTouched: engine.markFieldsTouched.bind(engine),
    hasValidationsInProgress: engine.hasValidationsInProgress.bind(engine),
    beginFieldValidation: engine.beginFieldValidation.bind(engine),
    endFieldValidation: engine.endFieldValidation.bind(engine),
    setFieldAsyncError: engine.setFieldAsyncError.bind(engine),
    clearFieldAsyncError: engine.clearFieldAsyncError.bind(engine),
    resolveMask: engine.resolveMask.bind(engine),
    getScopeFields: engine.getScopeFields.bind(engine),

    cleanup: engine.cleanup.bind(engine),
  };
}
