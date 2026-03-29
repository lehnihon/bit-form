import { BitPersistManager } from "../managers/features/persist-manager";
import { BitPluginManager } from "../managers/features/plugin-manager";
import { BitStoreEffectEngine } from "../engines/effect-engine";
import type { BitFrameworkConfig } from "../contracts/public/store-api-types";
import { bitBus, getNoopBitBus } from "../shared/bus";
import type { BitBusStorePort } from "../contracts/bus-types";
import type { BitState } from "../contracts/types";

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
  storeBusPort: BitBusStorePort<T>;
  config: BitFrameworkConfig<T>;
  getState: () => BitState<T>;
  getConfig: () => BitFrameworkConfig<T>;
  getValues: () => T;
  getDirtyValues: () => Partial<T>;
  applyPersistedValues: (values: Partial<T>) => void;
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
  } = args;

  const persistManager = new BitPersistManager<T>(
    config.persist,
    getValues,
    getDirtyValues,
    applyPersistedValues,
  );

  const pluginManager = new BitPluginManager<T>([...config.plugins], () => ({
    storeId,
    getState: () => getState(),
    getConfig: () => getConfig(),
  }));

  const enableBusDispatch = shouldEnableStoreBus(config);
  const resolvedBus = enableBusDispatch
    ? (config.bus ?? bitBus)
    : getNoopBitBus();

  const effects = new BitStoreEffectEngine<T>(
    storeId,
    storeBusPort,
    resolvedBus,
    persistManager,
    pluginManager,
    enableBusDispatch,
  );
  effects.initialize();

  return effects;
}
