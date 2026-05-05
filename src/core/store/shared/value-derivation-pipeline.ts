import { getDeepValue, setDeepValue, valueEqual } from "../../utils";
import { mergePaths } from "../../utils/path-utils";
import type { BitTransformFn } from "../contracts/types";
import type { BitNormalizerEntry } from "../registry/field-catalog";

interface BitDependencyAwareEntry {
  path: string;
  dependsOn: readonly string[];
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

function orderDependencyEntries<TEntry extends BitDependencyAwareEntry>(
  entries: readonly TEntry[],
  onError?: (error: unknown, path: string) => void,
): {
  orderedEntries: TEntry[];
  cyclePaths: string[];
} {
  if (entries.length <= 1) {
    return {
      orderedEntries: [...entries],
      cyclePaths: [],
    };
  }

  const entryByPath = new Map(entries.map((entry) => [entry.path, entry]));
  const inDegree = new Map<string, number>();
  const dependents = new Map<string, Set<string>>();
  const originalIndex = new Map(
    entries.map((entry, index) => [entry.path, index]),
  );

  entries.forEach((entry) => inDegree.set(entry.path, 0));

  entries.forEach((entry) => {
    entry.dependsOn.forEach((dependencyPath) => {
      if (dependencyPath === entry.path) {
        return;
      }
      if (!entryByPath.has(dependencyPath)) {
        if (typeof console !== "undefined" && console.warn) {
          console.warn(
            `BitStore: normalizer "${entry.path}" depends on "${dependencyPath}" which is not a registered normalizer. It will receive pre-computed values.`,
          );
        }
        onError?.(
          new Error(
            `BitStore: normalizer "${entry.path}" depends on "${dependencyPath}" which is not a registered normalizer.`,
          ),
          entry.path,
        );
        return;
      }

      const nextDependents =
        dependents.get(dependencyPath) ?? new Set<string>();
      if (nextDependents.has(entry.path)) {
        return;
      }

      nextDependents.add(entry.path);
      dependents.set(dependencyPath, nextDependents);
      inDegree.set(entry.path, (inDegree.get(entry.path) ?? 0) + 1);
    });
  });

  const queue = entries
    .filter((entry) => (inDegree.get(entry.path) ?? 0) === 0)
    .map((entry) => entry.path);
  const orderedPaths: string[] = [];

  while (queue.length > 0) {
    queue.sort(
      (left, right) =>
        (originalIndex.get(left) ?? 0) - (originalIndex.get(right) ?? 0),
    );

    const currentPath = queue.shift()!;
    orderedPaths.push(currentPath);

    const nextDependents = dependents.get(currentPath);
    if (!nextDependents) {
      continue;
    }

    nextDependents.forEach((dependentPath) => {
      const nextDegree = (inDegree.get(dependentPath) ?? 0) - 1;
      inDegree.set(dependentPath, nextDegree);

      if (nextDegree === 0) {
        queue.push(dependentPath);
      }
    });
  }

  if (orderedPaths.length !== entries.length) {
    const cyclePaths = entries
      .filter((entry) => (inDegree.get(entry.path) ?? 0) > 0)
      .map((entry) => entry.path);

    return {
      orderedEntries: orderedPaths.map((path) => entryByPath.get(path)!),
      cyclePaths,
    };
  }

  return {
    orderedEntries: orderedPaths.map((path) => entryByPath.get(path)!),
    cyclePaths: [],
  };
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

  const orderedResult = orderDependencyEntries(
    filterDependencyEntries(normalizerEntries, changedPaths),
    onError,
  );
  const { orderedEntries: targetedNormalizers, cyclePaths } = orderedResult;

  if (cyclePaths.length > 0) {
    onError?.(
      new Error(
        `BitStore: cyclic normalizer dependencies detected. Check normalizeDependsOn definitions for: ${cyclePaths.join(", ")}.`,
      ),
      cyclePaths[0] ?? "*",
    );
  }

  if (targetedNormalizers.length === 0) {
    return applyComputed(values, changedPaths);
  }

  const normalizerUpdates: Array<[string, unknown]> = [];
  let normalizedValues = values;

  for (const entry of targetedNormalizers) {
    const currentValue = getDeepValue(normalizedValues, entry.path);
    let derivedValue: unknown;

    try {
      derivedValue = entry.normalize(currentValue, normalizedValues);
    } catch (error) {
      onError?.(error, entry.path);
      continue;
    }

    if (valueEqual(currentValue, derivedValue)) {
      continue;
    }

    normalizerUpdates.push([entry.path, derivedValue]);
    normalizedValues = setDeepValue(normalizedValues, entry.path, derivedValue);
  }

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

  let transformedValues = values;
  let transformedAllValues = sourceValues;

  for (const [path, transform] of transformEntries) {
    const currentValue = getDeepValue(transformedValues, path);
    let derivedValue: unknown;

    try {
      derivedValue = transform(currentValue, transformedAllValues);
    } catch (error) {
      onError?.(error, path);
      continue;
    }

    if (valueEqual(currentValue, derivedValue)) {
      continue;
    }

    transformedValues = setDeepValue(transformedValues, path, derivedValue);
    transformedAllValues = setDeepValue(
      transformedAllValues,
      path,
      derivedValue,
    );
  }

  return transformedValues;
}
