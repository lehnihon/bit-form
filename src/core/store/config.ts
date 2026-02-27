import type { BitConfig, BitResolvedConfig } from "./types";
import { deepClone } from "../utils";
import { bitMasks } from "../mask";

/**
 * Normalizes BitConfig (nested) into flat BitResolvedConfig for internal use.
 */
export function normalizeConfig<T extends object>(
  config: BitConfig<T> = {},
): BitResolvedConfig<T> {
  const rawInitial = config.initialValues || ({} as T);
  const validation = config.validation;
  const history = config.history;
  const features = config.features;

  return {
    name: config.name,
    initialValues: deepClone(rawInitial),
    resolver: validation?.resolver,
    validationDelay: validation?.delay ?? 300,
    defaultRequiredMessage: validation?.defaultRequiredMessage,
    enableHistory: history?.enabled ?? false,
    historyLimit: history?.limit ?? 15,
    computed: features?.computed,
    transform: features?.transform,
    scopes: features?.scopes,
    masks: features?.masks ?? bitMasks,
    fields: config.fields,
    devTools: config.devTools,
  } as BitResolvedConfig<T>;
}
