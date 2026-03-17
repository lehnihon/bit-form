import { getDeepValue, setDeepValue, deepEqual } from "../../../utils";
import type { BitComputedFn } from "../../contracts/types";

export interface BitComputedEntry<T extends object> {
  path: string;
  compute: BitComputedFn<T>;
  dependsOn?: readonly string[];
}

type BitComputedEntryInput<T extends object> =
  | BitComputedEntry<T>
  | [string, BitComputedFn<T>];

interface BitComputedResolution<T extends object> {
  entries: BitComputedEntry<T>[];
  shouldTrackDependencies: boolean;
  requiresStabilizationPasses: boolean;
}

export class BitComputedManager<T extends object> {
  // Garantimos no mínimo alguns passes mesmo com poucos computeds para
  // estabilizar cadeias curtas de dependência (A->B->C) sem depender apenas
  // de computedEntries.length * 2.
  private static readonly MIN_PASSES = 4;
  private readonly computedDependencyCache = new Map<string, Set<string>>();

  constructor(private getComputedEntries: () => BitComputedEntryInput<T>[]) {}

  apply(values: T, changedPaths?: readonly string[]): T {
    const computedEntries = this.normalizeEntries(this.getComputedEntries());
    if (computedEntries.length === 0) return values;

    const resolution = this.resolveEntriesToRun(computedEntries, changedPaths);
    const entriesToRun = resolution.entries;

    if (entriesToRun.length === 0) {
      return values;
    }

    let nextValues = values;
    const maxPasses = resolution.requiresStabilizationPasses
      ? Math.max(BitComputedManager.MIN_PASSES, entriesToRun.length * 2)
      : 1;

    for (let i = 0; i < maxPasses; i++) {
      let hasUpdates = false;

      for (const entry of entriesToRun) {
        const { newValue, trackedDependencies } = this.computeWithTracking(
          entry,
          nextValues,
          resolution.shouldTrackDependencies,
        );
        const currentValue = getDeepValue(nextValues, entry.path);

        if (!deepEqual(currentValue, newValue)) {
          nextValues = setDeepValue(nextValues, entry.path, newValue);
          hasUpdates = true;
        }

        if (trackedDependencies) {
          this.computedDependencyCache.set(entry.path, trackedDependencies);
        }
      }

      if (!hasUpdates) break;

      if (resolution.requiresStabilizationPasses && i === maxPasses - 1) {
        throw new Error(
          "BitStore: computed fields did not stabilize. Check for cyclic computed definitions.",
        );
      }
    }

    return nextValues;
  }

  private resolveEntriesToRun(
    entries: BitComputedEntry<T>[],
    changedPaths?: readonly string[],
  ): BitComputedResolution<T> {
    if (
      !changedPaths ||
      changedPaths.length === 0 ||
      changedPaths.includes("*")
    ) {
      return {
        entries: this.orderEntries(entries),
        shouldTrackDependencies: true,
        requiresStabilizationPasses: true,
      };
    }

    const reverseDependencies = new Map<string, Set<string>>();
    let shouldTrackDependencies = false;

    for (const entry of entries) {
      const dependencies = this.getDependenciesForEntry(entry);

      if (dependencies.length === 0) {
        shouldTrackDependencies = true;
      }

      for (const dependency of dependencies) {
        const dependents = reverseDependencies.get(dependency) ?? new Set();
        dependents.add(entry.path);
        reverseDependencies.set(dependency, dependents);
      }
    }

    const affectedPaths = new Set<string>();
    const queue = [...changedPaths];

    while (queue.length > 0) {
      const currentPath = queue.shift()!;
      const dependents = this.getDependentsForPath(
        reverseDependencies,
        currentPath,
      );

      if (!dependents) {
        continue;
      }

      for (const dependentPath of dependents) {
        if (affectedPaths.has(dependentPath)) {
          continue;
        }

        affectedPaths.add(dependentPath);
        queue.push(dependentPath);
      }
    }

    if (affectedPaths.size === 0) {
      return {
        entries: [],
        shouldTrackDependencies,
        requiresStabilizationPasses: false,
      };
    }

    const affectedEntries = entries.filter((entry) =>
      affectedPaths.has(entry.path),
    );

    return {
      entries: this.orderEntries(affectedEntries),
      shouldTrackDependencies,
      requiresStabilizationPasses: shouldTrackDependencies,
    };
  }

  private normalizeEntries(entries: BitComputedEntryInput<T>[]) {
    return entries.map((entry) => {
      if (Array.isArray(entry)) {
        return {
          path: entry[0],
          compute: entry[1],
        } satisfies BitComputedEntry<T>;
      }

      return entry;
    });
  }

  private getDependenciesForEntry(entry: BitComputedEntry<T>) {
    return (
      entry.dependsOn ??
      Array.from(this.computedDependencyCache.get(entry.path) ?? [])
    );
  }

  private orderEntries(entries: BitComputedEntry<T>[]) {
    if (entries.length <= 1) {
      return entries;
    }

    const entryByPath = new Map(entries.map((entry) => [entry.path, entry]));
    const inDegree = new Map<string, number>();
    const dependents = new Map<string, Set<string>>();

    entries.forEach((entry) => inDegree.set(entry.path, 0));

    entries.forEach((entry) => {
      const dependencies = this.getDependenciesForEntry(entry);

      dependencies.forEach((dependencyPath) => {
        if (!entryByPath.has(dependencyPath)) {
          return;
        }

        const nextDependents = dependents.get(dependencyPath) ?? new Set();
        if (!nextDependents.has(entry.path)) {
          nextDependents.add(entry.path);
          dependents.set(dependencyPath, nextDependents);
          inDegree.set(entry.path, (inDegree.get(entry.path) ?? 0) + 1);
        }
      });
    });

    const queue = entries
      .filter((entry) => (inDegree.get(entry.path) ?? 0) === 0)
      .map((entry) => entry.path);
    const orderedPaths: string[] = [];

    while (queue.length > 0) {
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
      throw new Error(
        "BitStore: cyclic computed dependencies detected. Check computedDependsOn definitions.",
      );
    }

    return orderedPaths.map((path) => entryByPath.get(path)!);
  }

  private getDependentsForPath(
    reverseDependencies: Map<string, Set<string>>,
    changedPath: string,
  ) {
    const dependents = new Set<string>();

    const collect = (dependencyPath: string) => {
      const listeners = reverseDependencies.get(dependencyPath);
      if (!listeners) {
        return;
      }

      listeners.forEach((path) => dependents.add(path));
    };

    collect(changedPath);

    const parentSegments = changedPath.split(".");
    while (parentSegments.length > 1) {
      parentSegments.pop();
      collect(parentSegments.join("."));
    }

    reverseDependencies.forEach((_listeners, dependencyPath) => {
      if (dependencyPath.startsWith(`${changedPath}.`)) {
        collect(dependencyPath);
      }
    });

    return dependents;
  }

  private computeWithTracking(
    entry: BitComputedEntry<T>,
    values: T,
    shouldTrackDependencies: boolean,
  ) {
    const knownDependencies = this.getDependenciesForEntry(entry);

    if (!shouldTrackDependencies || knownDependencies.length > 0) {
      return {
        newValue: entry.compute(values),
        trackedDependencies: null as Set<string> | null,
      };
    }

    const trackedDependencies = new Set<string>();
    const trackedValues = this.createTrackedValues(values, trackedDependencies);

    const newValue = entry.compute(trackedValues);

    return {
      newValue,
      trackedDependencies,
    };
  }

  private createTrackedValues(values: T, trackedDependencies: Set<string>): T {
    const createProxy = (value: unknown, currentPath: string): unknown => {
      if (!value || typeof value !== "object") {
        return value;
      }

      return new Proxy(value as Record<string, unknown>, {
        get: (target, key) => {
          if (typeof key !== "string") {
            return Reflect.get(target, key);
          }

          const nextPath = currentPath ? `${currentPath}.${key}` : key;
          trackedDependencies.add(nextPath);

          const nextValue = Reflect.get(target, key);
          return createProxy(nextValue, nextPath);
        },
      });
    };

    return createProxy(values, "") as T;
  }
}
