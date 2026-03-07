import { BitStore } from "./index";
import { BitConfig } from "./types";
import { BitPublicStore } from "./public-types";

export function createBitStore<T extends object = any>(
  config: BitConfig<T> = {},
): BitPublicStore<T> {
  const engine = new BitStore<T>(config);

  return {
    getConfig: () => engine.getConfig(),
    getState: () => engine.getState(),
    subscribe: engine.subscribe.bind(engine),

    setField: engine.setField.bind(engine),
    blurField: engine.blurField.bind(engine),
    setValues: engine.setValues.bind(engine),

    setError: engine.setError.bind(engine),
    setErrors: engine.setErrors.bind(engine),
    setServerErrors: engine.setServerErrors.bind(engine),

    validate: engine.validate.bind(engine),
    reset: engine.reset.bind(engine),
    submit: engine.submit.bind(engine),

    registerMask: engine.registerMask.bind(engine),
    getDirtyValues: engine.getDirtyValues.bind(engine),

    cleanup: engine.cleanup.bind(engine),
  };
}

export function createBitStoreEngine<T extends object = any>(
  config: BitConfig<T> = {},
): BitStore<T> {
  return new BitStore<T>(config);
}
