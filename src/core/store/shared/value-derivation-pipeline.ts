import { getDeepValue, setDeepValues, valueEqual } from "../../utils";
import type { BitTransformFn } from "../contracts/types";
import type { BitNormalizerEntry } from "../registry/field-catalog";

export function applyTransformDerivations<T extends object>(args: {
  values: T;
  sourceValues: T;
  transformEntries: readonly [string, BitTransformFn<T>][];
}): T {
  const { values, sourceValues, transformEntries } = args;
  if (transformEntries.length === 0) {
    return values;
  }

  const updates: Array<[string, unknown]> = [];

  for (const [path, transform] of transformEntries) {
    const currentValue = getDeepValue(values, path);
    const transformedValue = transform(currentValue, sourceValues);

    if (!valueEqual(currentValue, transformedValue)) {
      updates.push([path, transformedValue]);
    }
  }

  if (updates.length === 0) {
    return values;
  }

  return setDeepValues(values, updates);
}

export function applyComputedDerivations<T extends object>(args: {
  values: T;
  changedPaths?: readonly string[];
  applyComputed: (values: T, changedPaths?: readonly string[]) => T;
}): T {
  return args.applyComputed(args.values, args.changedPaths);
}

export function applyNormalizerDerivations<T extends object>(args: {
  values: T;
  changedPaths?: readonly string[];
  normalizerEntries: readonly BitNormalizerEntry<T>[];
}): T {
  const { values, changedPaths, normalizerEntries } = args;

  if (normalizerEntries.length === 0) {
    return values;
  }

  const hasWildcardChange = changedPaths?.includes("*") ?? false;

  const isDependencyImpacted = (dependencyPath: string) => {
    if (!changedPaths || changedPaths.length === 0 || hasWildcardChange) {
      return true;
    }

    return changedPaths.some(
      (changedPath) =>
        dependencyPath === changedPath ||
        dependencyPath.startsWith(`${changedPath}.`) ||
        changedPath.startsWith(`${dependencyPath}.`),
    );
  };

  const targetedNormalizers =
    !changedPaths || changedPaths.length === 0 || hasWildcardChange
      ? normalizerEntries
      : normalizerEntries.filter((entry) =>
          entry.dependsOn.some((dependencyPath) =>
            isDependencyImpacted(dependencyPath),
          ),
        );

  if (targetedNormalizers.length === 0) {
    return values;
  }

  const updates: Array<[string, unknown]> = [];

  for (const entry of targetedNormalizers) {
    const currentValue = getDeepValue(values, entry.path);
    const normalizedValue = entry.normalize(currentValue, values);

    if (!valueEqual(currentValue, normalizedValue)) {
      updates.push([entry.path, normalizedValue]);
    }
  }

  if (updates.length === 0) {
    return values;
  }

  return setDeepValues(values, updates);
}
