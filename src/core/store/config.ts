import type { BitConfig } from "./types";
import type { BitResolvedConfig } from "./internal-types";
import { deepClone } from "../utils";
import { bitMasks } from "../mask";

export function normalizeConfig<T extends object>(
  config: BitConfig<T> = {},
): BitResolvedConfig<T> {
  const rawInitial = (config.initialValues ?? {}) as T;
  const validation = config.validation;
  const history = config.history;

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
  } as BitResolvedConfig<T>;
}
