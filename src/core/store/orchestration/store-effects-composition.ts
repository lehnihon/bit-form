import { deepClone } from "../../utils";
import type { BitBusStorePort } from "../contracts/bus-types";
import type { BitFrameworkConfig } from "../contracts/public/store-api-types";
import type { BitPersistMetadata, BitState } from "../contracts/types";
import { BitStoreEffectEngine } from "../engines/effect-engine";
import { BitBusEffects } from "../engines/effects/bus-effects";
import { BitEffectRegistry } from "../engines/effects/effect-registry";
import { BitPersistEffects } from "../engines/effects/persist-effects";
import { BitPluginEffects } from "../engines/effects/plugin-effects";
import { BitPersistManager } from "../managers/features/persist-manager";
import { BitPluginManager } from "../managers/features/plugin-manager";
import { bitBus, getNoopBitBus } from "../shared/bus";

function shouldEnableStoreBus<T extends object>(config: BitFrameworkConfig<T>) {
  if (config.bus) {
    return true;
  }

  if (typeof config.devTools === "boolean") {
    return config.devTools;
  }

  if (config.devTools && typeof config.devTools === "object") {
    return config.devTools.enabled !== false;
  }

  return false;
}

export function createStoreEffects<T extends object>(args: {
  storeId: string;
  storeBusPort?: BitBusStorePort<T>;
  config: BitFrameworkConfig<T>;
  getState: () => BitState<T>;
  getConfig: () => BitFrameworkConfig<T>;
  getValues: () => T;
  getDirtyValues: () => Partial<T>;
  applyPersistedValues: (values: Partial<T>) => void;
  setPersistMetadata?: (patch: Partial<BitPersistMetadata>) => void;
}): BitStoreEffectEngine<T> {
  const {
    storeId,
    storeBusPort,
    config,
    getState,
    getConfig,
    getValues,
    getDirtyValues,
    applyPersistedValues,
    setPersistMetadata,
  } = args;

  const persistManager = new BitPersistManager<T>(
    config.persist,
    getValues,
    getDirtyValues,
    applyPersistedValues,
    {
      onWriteStart: () => setPersistMetadata?.({ isSaving: true, error: null }),
      onWriteSuccess: () =>
        setPersistMetadata?.({ isSaving: false, error: null }),
      onWriteError: (error) =>
        setPersistMetadata?.({
          error: error instanceof Error ? error : new Error(String(error)),
        }),
      onWriteSettled: () => setPersistMetadata?.({ isSaving: false }),
      onError: (error) => config.onUnhandledError(error, "persist"),
    },
  );

  const enableBusDispatch = shouldEnableStoreBus(config);
  const isTestEnv =
    typeof process !== "undefined" &&
    typeof process.env !== "undefined" &&
    process.env.VITEST === "true";
  const resolvedBus = enableBusDispatch
    ? (config.bus ?? (isTestEnv ? getNoopBitBus() : bitBus))
    : getNoopBitBus();

  const pluginManager = new BitPluginManager<T>([...config.plugins], () => ({
    storeId,
    getState: () => deepClone(getState()),
    getConfig: () => deepClone(getConfig()),
    bus: resolvedBus,
  }));

  const registry = new BitEffectRegistry<T>();
  let destroyed = false;

  const persistEffects = new BitPersistEffects<T>(persistManager);
  registry.register({
    name: "persist",
    onStateUpdated: (nextState, valuesChanged) =>
      persistEffects.onStateUpdated(nextState, valuesChanged),
    initialize: () => persistEffects.initialize(),
    restorePersisted: async () => {
      if (destroyed) return false;
      const restored = await persistEffects.restorePersisted();
      if (destroyed) return false;
      return restored;
    },
    savePersistedNow: () => persistEffects.savePersistedNow(),
    clearPersisted: () => persistEffects.clearPersisted(),
    destroy: () => {
      destroyed = true;
      persistEffects.destroy();
    },
  });

  const pluginEffects = new BitPluginEffects<T>(pluginManager);
  registry.register({
    name: "plugins",
    initialize: () => pluginEffects.initialize(),
    beforeValidate: (event) => pluginEffects.beforeValidate(event),
    afterValidate: (event) => pluginEffects.afterValidate(event),
    beforeSubmit: (event) => pluginEffects.beforeSubmit(event),
    afterSubmit: (event) => pluginEffects.afterSubmit(event),
    onFieldChange: (event) => pluginEffects.onFieldChange(event),
    reportOperationalError: (event) =>
      pluginEffects.reportOperationalError(event),
    destroy: () => pluginEffects.destroy(),
  });

  const busEffects = new BitBusEffects<T>(
    storeId,
    resolvedBus,
    enableBusDispatch,
    storeBusPort,
  );
  registry.register({
    name: "bus",
    attachStorePort: (port) => busEffects.attachStorePort(port),
    initialize: () => busEffects.initialize(),
    onStateUpdated: (nextState) => busEffects.onStateUpdated(nextState),
    destroy: () => busEffects.destroy(),
  });

  const effects = new BitStoreEffectEngine<T>(registry);

  try {
    effects.initialize();
  } catch (error) {
    console.error(
      "BitStoreEffects: initialize() failed — store will operate without initialized effects",
      error,
    );
  }

  return effects;
}
