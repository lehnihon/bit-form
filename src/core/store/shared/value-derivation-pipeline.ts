import { getDeepValue, setDeepValues, valueEqual } from "../../utils";
import type { BitTransformFn } from "../contracts/types";
import type { BitNormalizerEntry } from "../registry/field-catalog";

interface BitDependencyAwareEntry {
  path: string;
  dependsOn: readonly string[];
}

function mergeChangedPaths(
  previous?: readonly string[],
  next?: readonly string[],
): string[] | undefined {
  if ((!previous || previous.length === 0) && (!next || next.length === 0)) {
    return undefined;
  }

  const merged = new Set<string>(previous ?? []);
  next?.forEach((path) => merged.add(path));
  return Array.from(merged);
}

function collectChangedValueUpdates<
  T extends object,
  TEntry extends { path: string },
>(args: {
  values: T;
  entries: readonly TEntry[];
  deriveValue: (entry: TEntry, currentValue: unknown) => unknown;
}): Array<[string, unknown]> {
  const { values, entries, deriveValue } = args;
  const updates: Array<[string, unknown]> = [];

  for (const entry of entries) {
    const currentValue = getDeepValue(values, entry.path);
    const derivedValue = deriveValue(entry, currentValue);

    if (!valueEqual(currentValue, derivedValue)) {
      updates.push([entry.path, derivedValue]);
    }
  }

  return updates;
}

export function createDependencyImpactChecker(
  changedPaths?: readonly string[],
) {
  const hasWildcardChange = changedPaths?.includes("*") ?? false;

  return (dependencyPath: string) => {
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
}

export function filterDependencyEntries<TEntry extends BitDependencyAwareEntry>(
  entries: readonly TEntry[],
  changedPaths?: readonly string[],
): readonly TEntry[] {
  if (
    !changedPaths ||
    changedPaths.length === 0 ||
    changedPaths.includes("*")
  ) {
    return entries;
  }

  const isDependencyImpacted = createDependencyImpactChecker(changedPaths);
  return entries.filter((entry) =>
    entry.dependsOn.some((dependencyPath) =>
      isDependencyImpacted(dependencyPath),
    ),
  );
}

export function applyValueDerivations<T extends object>(args: {
  values: T;
  changedPaths?: readonly string[];
  normalizerEntries: readonly BitNormalizerEntry<T>[];
  applyComputed: (values: T, changedPaths?: readonly string[]) => T;
}): T {
  const { values, changedPaths, normalizerEntries, applyComputed } = args;

  const targetedNormalizers = filterDependencyEntries(
    normalizerEntries,
    changedPaths,
  );

  if (targetedNormalizers.length === 0) {
    return applyComputed(values, changedPaths);
  }

  const normalizerUpdates = collectChangedValueUpdates({
    values,
    entries: targetedNormalizers,
    deriveValue: (entry, currentValue) => entry.normalize(currentValue, values),
  });

  const normalizedValues =
    normalizerUpdates.length > 0
      ? setDeepValues(values, normalizerUpdates)
      : values;
  const nextChangedPaths = mergeChangedPaths(
    changedPaths,
    normalizerUpdates.map(([path]) => path),
  );

  return applyComputed(normalizedValues, nextChangedPaths);
}

export function applyTransformDerivations<T extends object>(args: {
  values: T;
  sourceValues: T;
  transformEntries: readonly [string, BitTransformFn<T>][];
}): T {
  const { values, sourceValues, transformEntries } = args;
  if (transformEntries.length === 0) {
    return values;
  }

  const updates = collectChangedValueUpdates({
    values,
    entries: transformEntries.map(([path, transform]) => ({ path, transform })),
    deriveValue: (entry, currentValue) =>
      entry.transform(currentValue, sourceValues),
  });

  if (updates.length === 0) {
    return values;
  }

  return setDeepValues(values, updates);
}
