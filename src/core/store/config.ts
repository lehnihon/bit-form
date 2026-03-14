import type { BitConfig, BitPersistResolvedConfig } from "./types";
import type { BitResolvedConfig } from "./public-types";
import { deepClone } from "../utils";
import { bitMasks } from "../mask";

export function normalizeConfig<T extends object>(
  config: BitConfig<T> = {},
): BitResolvedConfig<T> {
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
    enableHistory: history?.enabled ?? false,
    historyLimit: history?.limit ?? 15,
    masks: { ...bitMasks },
    fields: config.fields,
    devTools: config.devTools,
    persist,
    plugins: config.plugins ?? [],
  } as BitResolvedConfig<T>;
}
