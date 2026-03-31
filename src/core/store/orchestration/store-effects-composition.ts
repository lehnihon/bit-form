import type { BitBusStorePort } from "../contracts/bus-types";
import type { BitFrameworkConfig } from "../contracts/public/store-api-types";
import type { BitState } from "../contracts/types";
import { BitStoreEffectEngine } from "../engines/effect-engine";
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
  const isTestEnv =
    typeof process !== "undefined" &&
    typeof process.env !== "undefined" &&
    process.env.VITEST === "true";
  const resolvedBus = enableBusDispatch
    ? (config.bus ?? (isTestEnv ? getNoopBitBus() : bitBus))
    : getNoopBitBus();

  const effects = new BitStoreEffectEngine<T>(
    storeId,
    resolvedBus,
    persistManager,
    pluginManager,
    enableBusDispatch,
    storeBusPort,
  );
  effects.initialize();

  return effects;
}
