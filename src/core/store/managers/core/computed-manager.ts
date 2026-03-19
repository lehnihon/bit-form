import { getDeepValue, setDeepValue, deepEqual } from "../../../utils";
import type { BitComputedFn } from "../../contracts/types";

export interface BitComputedEntry<T extends object> {
  path: string;
  compute: BitComputedFn<T>;
  dependsOn: readonly string[];
}

export class BitComputedManager<T extends object> {
  private equalityCache = new Map<
    string,
    { current: unknown; next: unknown; equal: boolean }
  >();
  private reverseDepsCache: Map<string, Set<string>> | null = null;
  private childDepsIndex: Map<string, Set<string>> | null = null;

  constructor(private getComputedEntries: () => BitComputedEntry<T>[]) {}

  invalidateReverseDeps(): void {
    this.reverseDepsCache = null;
    this.childDepsIndex = null;
  }

  apply(values: T, changedPaths?: readonly string[]): T {
    const computedEntries = this.getComputedEntries();
    if (computedEntries.length === 0) return values;

    computedEntries.forEach((entry) => this.assertDependencies(entry));

    const entriesToRun = this.resolveEntriesToRun(
      computedEntries,
      changedPaths,
    );

    if (entriesToRun.length === 0) {
      return values;
    }

    let nextValues = values;

    for (const entry of entriesToRun) {
      const newValue = entry.compute(nextValues);
      const currentValue = getDeepValue(nextValues, entry.path);

      const cached = this.equalityCache.get(entry.path);
      let valuesEqual: boolean;

      if (
        cached &&
        cached.current === currentValue &&
        cached.next === newValue
      ) {
        valuesEqual = cached.equal;
      } else {
        valuesEqual = deepEqual(currentValue, newValue);
        this.equalityCache.set(entry.path, {
          current: currentValue,
          next: newValue,
          equal: valuesEqual,
        });
      }

      if (!valuesEqual) {
        nextValues = setDeepValue(nextValues, entry.path, newValue);
      }
    }

    this.equalityCache.clear();
    return nextValues;
  }

  private getReverseDependencies(
    entries: BitComputedEntry<T>[],
  ): Map<string, Set<string>> {
    if (this.reverseDepsCache) return this.reverseDepsCache;

    const map = new Map<string, Set<string>>();

    for (const entry of entries) {
      for (const dep of entry.dependsOn) {
        let dependents = map.get(dep);
        if (!dependents) {
          dependents = new Set();
          map.set(dep, dependents);
        }
        dependents.add(entry.path);
      }
    }

    const childIdx = new Map<string, Set<string>>();

    for (const dep of map.keys()) {
      const segments = dep.split(".");
      for (let len = 1; len < segments.length; len++) {
        const prefix = segments.slice(0, len).join(".");
        let children = childIdx.get(prefix);
        if (!children) {
          children = new Set();
          childIdx.set(prefix, children);
        }
        children.add(dep);
      }
    }

    this.reverseDepsCache = map;
    this.childDepsIndex = childIdx;
    return map;
  }

  private resolveEntriesToRun(
    entries: BitComputedEntry<T>[],
    changedPaths?: readonly string[],
  ): BitComputedEntry<T>[] {
    if (
      !changedPaths ||
      changedPaths.length === 0 ||
      changedPaths.includes("*")
    ) {
      return this.orderEntries(entries);
    }

    const reverseDependencies = this.getReverseDependencies(entries);
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
      return [];
    }

    return this.orderEntries(
      entries.filter((entry) => affectedPaths.has(entry.path)),
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
      entry.dependsOn.forEach((dependencyPath) => {
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

    const childKeys = this.childDepsIndex?.get(changedPath);
    if (childKeys) {
      for (const childDep of childKeys) {
        collect(childDep);
      }
    }

    return dependents;
  }

  private assertDependencies(entry: BitComputedEntry<T>) {
    if (entry.dependsOn.length === 0) {
      throw new Error(
        `BitStore: computed field \`${entry.path}\` requires explicit computedDependsOn in v4.`,
      );
    }

    if (entry.dependsOn.includes(entry.path)) {
      throw new Error(
        `BitStore: computed field \`${entry.path}\` cannot depend on itself.`,
      );
    }
  }
}
