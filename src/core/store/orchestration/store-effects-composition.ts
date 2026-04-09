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
      onAutoSaveStart: () =>
        setPersistMetadata?.({ isSaving: true, error: null }),
      onAutoSaveSuccess: () =>
        setPersistMetadata?.({ isSaving: false, error: null }),
      onAutoSaveError: (error) =>
        setPersistMetadata?.({
          isSaving: false,
          error: error instanceof Error ? error : new Error(String(error)),
        }),
      onError: (error) => config.onUnhandledError(error, "persist"),
    },
  );

  const pluginManager = new BitPluginManager<T>([...config.plugins], () => ({
    storeId,
    getState: () => getState(),
    getConfig: () => getConfig(),
  }));

  const enableBusDispatch = shouldEnableStoreBus(config);
  const isTestEnv =
    typeof process !== "undefined" &&
    typeof process.env !== "undefined" &&
    process.env.VITEST === "true";
  const resolvedBus = enableBusDispatch
    ? (config.bus ?? (isTestEnv ? getNoopBitBus() : bitBus))
    : getNoopBitBus();

  const registry = new BitEffectRegistry<T>();

  const persistEffects = new BitPersistEffects<T>(persistManager);
  registry.register({
    name: "persist",
    onStateUpdated: (nextState, valuesChanged) =>
      persistEffects.onStateUpdated(nextState, valuesChanged),
    restorePersisted: () => persistEffects.restorePersisted(),
    savePersistedNow: () => persistEffects.savePersistedNow(),
    clearPersisted: () => persistEffects.clearPersisted(),
    destroy: () => persistEffects.destroy(),
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

  effects.initialize();

  return effects;
}
