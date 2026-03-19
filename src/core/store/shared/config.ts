import type { BitConfig, BitPersistResolvedConfig } from "../contracts/types";
import type { BitFrameworkConfig } from "../contracts/public-types";
import { deepClone } from "../../utils";

function defaultIdFactory() {
  return `bit-form-${Math.random().toString(36).slice(2, 9)}`;
}

export function normalizeConfig<T extends object>(
  config: BitConfig<T> = {},
): BitFrameworkConfig<T> {
  const rawInitial = (config.initialValues ?? {}) as T;
  const validation = config.validation;
  const history = config.history;

  const defaultPersistKey = config.name
    ? `bit-form:${config.name}:draft`
    : "bit-form:draft";

  const persist: BitPersistResolvedConfig<T> = {
    enabled: config.persist?.enabled ?? false,
    key: config.persist?.key ?? defaultPersistKey,
    storage: config.persist?.storage,
    autoSave: config.persist?.autoSave ?? true,
    debounceMs: config.persist?.debounceMs ?? 300,
    mode: config.persist?.mode ?? "values",
    serialize: config.persist?.serialize ?? JSON.stringify,
    deserialize:
      config.persist?.deserialize ??
      ((raw: string) => JSON.parse(raw) as Partial<T>),
    onError: config.persist?.onError,
  };

  return {
    name: config.name,
    initialValues: deepClone(rawInitial),
    resolver: validation?.resolver,
    validationDelay: validation?.delay ?? 300,
    history: {
      enabled: history?.enabled ?? false,
      limit: history?.limit ?? 50,
    },
    masks: config.masks,
    fields: config.fields,
    devTools: config.devTools,
    persist,
    idFactory: config.idFactory ?? defaultIdFactory,
    plugins: config.plugins ?? [],
    scheduler: config.scheduler,
    subscriptionCacheSize: config.subscriptionCacheSize,
    bus: config.bus,
  } as BitFrameworkConfig<T>;
}
