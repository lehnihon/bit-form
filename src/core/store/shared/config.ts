import { deepClone } from "../../utils";
import type { BitFrameworkConfig } from "../contracts/public/store-api-types";
import type { BitConfig, BitPersistResolvedConfig } from "../contracts/types";

function defaultIdFactory() {
  return `bit-form-${Math.random().toString(36).slice(2, 9)}`;
}

function defaultUnhandledErrorReporter(error: unknown) {
  if (typeof console !== "undefined" && typeof console.error === "function") {
    console.error(error);
  }
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

  const onUnhandledError =
    config.onUnhandledError ?? defaultUnhandledErrorReporter;
  const persistErrorHandler = config.persist?.onError;

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
    onError: (error) => {
      if (persistErrorHandler) {
        persistErrorHandler(error);
        return;
      }

      onUnhandledError(error, "persist");
    },
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
    fields: config.fields,
    devTools: config.devTools,
    persist,
    idFactory: config.idFactory ?? defaultIdFactory,
    plugins: config.plugins ?? [],
    scheduler: config.scheduler,
    subscriptionCacheSize: config.subscriptionCacheSize,
    trackedSubscriptions: config.trackedSubscriptions ?? false,
    bus: config.bus,
    onUnhandledError,
  } as BitFrameworkConfig<T>;
}
