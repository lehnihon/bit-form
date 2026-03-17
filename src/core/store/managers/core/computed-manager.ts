import { getDeepValue, setDeepValues, deepEqual } from "../../../utils";
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
    const maxPasses = Math.max(
      BitComputedManager.MIN_PASSES,
      entriesToRun.length * 2,
    );

    for (let i = 0; i < maxPasses; i++) {
      const pendingUpdates: [string, unknown][] = [];

      for (const entry of entriesToRun) {
        const { newValue, trackedDependencies } = this.computeWithTracking(
          entry,
          nextValues,
          resolution.shouldTrackDependencies,
        );
        const currentValue = getDeepValue(nextValues, entry.path);

        if (!deepEqual(currentValue, newValue)) {
          pendingUpdates.push([entry.path, newValue]);
        }

        if (trackedDependencies) {
          this.computedDependencyCache.set(entry.path, trackedDependencies);
        }
      }

      if (pendingUpdates.length === 0) break;

      nextValues = setDeepValues(nextValues, pendingUpdates);

      if (i === maxPasses - 1) {
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
        entries,
        shouldTrackDependencies: true,
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
      };
    }

    return {
      entries: entries.filter((entry) => affectedPaths.has(entry.path)),
      shouldTrackDependencies,
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
