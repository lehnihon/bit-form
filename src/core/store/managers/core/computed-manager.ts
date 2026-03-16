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

export class BitComputedManager<T extends object> {
  // Garantimos no mínimo alguns passes mesmo com poucos computeds para
  // estabilizar cadeias curtas de dependência (A->B->C) sem depender apenas
  // de computedEntries.length * 2.
  private static readonly MIN_PASSES = 4;

  constructor(private getComputedEntries: () => BitComputedEntryInput<T>[]) {}

  apply(values: T, changedPaths?: readonly string[]): T {
    const computedEntries = this.normalizeEntries(this.getComputedEntries());
    if (computedEntries.length === 0) return values;

    const entriesToRun = this.resolveEntriesToRun(
      computedEntries,
      changedPaths,
    );
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
        const newValue = entry.compute(nextValues);
        const currentValue = getDeepValue(nextValues, entry.path);

        if (!deepEqual(currentValue, newValue)) {
          pendingUpdates.push([entry.path, newValue]);
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
  ) {
    if (
      !changedPaths ||
      changedPaths.length === 0 ||
      changedPaths.includes("*")
    ) {
      return entries;
    }

    const reverseDependencies = new Map<string, Set<string>>();
    const entryByPath = new Map<string, BitComputedEntry<T>>();

    for (const entry of entries) {
      entryByPath.set(entry.path, entry);

      if (!entry.dependsOn || entry.dependsOn.length === 0) {
        return entries;
      }

      for (const dependency of entry.dependsOn) {
        const dependents = reverseDependencies.get(dependency) ?? new Set();
        dependents.add(entry.path);
        reverseDependencies.set(dependency, dependents);
      }
    }

    const affectedPaths = new Set<string>();
    const queue = [...changedPaths];

    while (queue.length > 0) {
      const currentPath = queue.shift()!;
      const dependents = reverseDependencies.get(currentPath);

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
      return [];
    }

    return entries.filter(
      (entry) => entryByPath.has(entry.path) && affectedPaths.has(entry.path),
    );
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
}
