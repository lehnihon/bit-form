import { getDeepValue, setDeepValues, valueEqual } from "../../utils";
import { mergePaths } from "../../utils/path-utils";
import type { BitTransformFn } from "../contracts/types";
import type { BitNormalizerEntry } from "../registry/field-catalog";

interface BitDependencyAwareEntry {
  path: string;
  dependsOn: readonly string[];
}

function collectChangedValueUpdates<
  T extends object,
  TEntry extends { path: string },
>(args: {
  values: T;
  entries: readonly TEntry[];
  deriveValue: (entry: TEntry, currentValue: unknown) => unknown;
  onError?: (error: unknown, path: string) => void;
}): Array<[string, unknown]> {
  const { values, entries, deriveValue, onError } = args;
  const updates: Array<[string, unknown]> = [];

  for (const entry of entries) {
    const currentValue = getDeepValue(values, entry.path);
    let derivedValue: unknown;

    try {
      derivedValue = deriveValue(entry, currentValue);
    } catch (error) {
      onError?.(error, entry.path);
      continue; // Skip this entry, continue with next
    }

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
  const changedPathSet = new Set(changedPaths ?? []);
  const changedAncestorSet = new Set<string>();

  for (const changedPath of changedPathSet) {
    changedAncestorSet.add(changedPath);

    let separatorIndex = changedPath.lastIndexOf(".");
    while (separatorIndex > -1) {
      changedAncestorSet.add(changedPath.slice(0, separatorIndex));
      separatorIndex = changedPath.lastIndexOf(".", separatorIndex - 1);
    }
  }

  return (dependencyPath: string) => {
    if (!changedPaths || changedPaths.length === 0 || hasWildcardChange) {
      return true;
    }

    if (changedPathSet.has(dependencyPath)) {
      return true;
    }

    if (changedAncestorSet.has(dependencyPath)) {
      return true;
    }

    let separatorIndex = dependencyPath.lastIndexOf(".");
    while (separatorIndex > -1) {
      if (changedPathSet.has(dependencyPath.slice(0, separatorIndex))) {
        return true;
      }

      separatorIndex = dependencyPath.lastIndexOf(".", separatorIndex - 1);
    }

    return false;
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
  onError?: (error: unknown, path: string) => void;
}): T {
  const { values, changedPaths, normalizerEntries, applyComputed, onError } =
    args;

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
    onError,
  });

  const normalizedValues =
    normalizerUpdates.length > 0
      ? setDeepValues(values, normalizerUpdates)
      : values;
  const nextChangedPaths = mergePaths(
    changedPaths,
    normalizerUpdates.map(([path]) => path),
  );

  return applyComputed(normalizedValues, nextChangedPaths);
}

export function applyTransformDerivations<T extends object>(args: {
  values: T;
  sourceValues: T;
  transformEntries: readonly [string, BitTransformFn<T>][];
  onError?: (error: unknown, path: string) => void;
}): T {
  const { values, sourceValues, transformEntries, onError } = args;
  if (transformEntries.length === 0) {
    return values;
  }

  const updates = collectChangedValueUpdates({
    values,
    entries: transformEntries.map(([path, transform]) => ({ path, transform })),
    deriveValue: (entry, currentValue) =>
      entry.transform(currentValue, sourceValues),
    onError,
  });

  if (updates.length === 0) {
    return values;
  }

  return setDeepValues(values, updates);
}
