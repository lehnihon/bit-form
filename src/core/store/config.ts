import type {
  BitConfig,
  BitResolvedConfig,
  BitFieldDefinition,
} from "./types";
import { deepClone } from "../utils";
import { bitMasks } from "../mask";

function deriveFromFields<T extends object>(
  fields: Record<string, BitFieldDefinition<T>> | undefined,
) {
  const computed: Record<string, (values: T) => any> = {};
  const transform: Partial<Record<string, (value: any, allValues: T) => any>> =
    {};
  const scopes: Record<string, string[]> = {};

  if (!fields) return { computed, transform, scopes };

  for (const [path, def] of Object.entries(fields)) {
    if (def?.computed) computed[path] = def.computed;
    if (def?.transform) transform[path] = def.transform;
    if (def?.scope) {
      if (!scopes[def.scope]) scopes[def.scope] = [];
      scopes[def.scope].push(path);
    }
  }

  return {
    computed: Object.keys(computed).length ? computed : undefined,
    transform: Object.keys(transform).length ? transform : undefined,
    scopes: Object.keys(scopes).length ? scopes : undefined,
  };
}

/**
 * Normalizes BitConfig into BitResolvedConfig for internal use.
 * Derives computed, transform, scopes from fields.
 */
export function normalizeConfig<T extends object>(
  config: BitConfig<T> = {},
): BitResolvedConfig<T> {
  const rawInitial = config.initialValues || ({} as T);
  const validation = config.validation;
  const history = config.history;
  const { computed, transform, scopes } = deriveFromFields(config.fields);

  return {
    name: config.name,
    initialValues: deepClone(rawInitial),
    resolver: validation?.resolver,
    validationDelay: validation?.delay ?? 300,
    defaultRequiredMessage: validation?.defaultRequiredMessage,
    enableHistory: history?.enabled ?? false,
    historyLimit: history?.limit ?? 15,
    computed,
    transform,
    scopes,
    masks: bitMasks,
    fields: config.fields,
    devTools: config.devTools,
  } as BitResolvedConfig<T>;
}
