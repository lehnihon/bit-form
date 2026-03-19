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

  /**
   * Equality cache por path sem serialização.
   * Evita custo de JSON.stringify em hot path e reaproveita resultado
   * quando current/new não mudam por identidade na mesma execução de apply().
   */
  private equalityCache = new Map<
    string,
    { current: unknown; next: unknown; equal: boolean }
  >();

  constructor(private getComputedEntries: () => BitComputedEntryInput<T>[]) {}
  /**
   * Cache de dependências reversas (entry.path → Set<paths que dependem dela>).
   * Construído uma vez e reutilizado em todos os apply() subsequentes.
   * Invalidado via invalidateReverseDeps() quando os computed entries mudam
   * (registro/unregistro de campos).
   */
  private reverseDepsCache: Map<string, Set<string>> | null = null;

  /**
   * Índice de filhos: prefix → Set de chaves em reverseDepsCache que
   * _começam_ com `prefix + "."`. Construído junto com reverseDepsCache
   * para substituir a varredura linear `forEach(startsWith)` por O(1).
   */
  private childDepsIndex: Map<string, Set<string>> | null = null;

  /** Chamado por BitStore.invalidateFieldIndexes() ao registrar/desregistrar campos. */
  invalidateReverseDeps(): void {
    this.reverseDepsCache = null;
    this.childDepsIndex = null;
  }

  /** Constrói (ou retorna cacheado) o mapa de dependências reversas para as entries dadas. */
  private getReverseDependencies(
    entries: BitComputedEntry<T>[],
  ): Map<string, Set<string>> {
    if (this.reverseDepsCache) return this.reverseDepsCache;

    const map = new Map<string, Set<string>>();

    for (const entry of entries) {
      const dependencies = this.getDependenciesForEntry(entry);
      for (const dep of dependencies) {
        let dependents = map.get(dep);
        if (!dependents) {
          dependents = new Set();
          map.set(dep, dependents);
        }
        dependents.add(entry.path);
      }
    }

    // Constrói o índice de prefixos filho uma única vez junto com o mapa reverso.
    // Para cada chave `dep` (ex.: "a.b.c"), registra `dep` sob todos os seus
    // segmentos pai ("a", "a.b") para que getDependentsForPath possa responder
    // "quem depende de coisas abaixo de X?" em O(filhos) em vez de O(n).
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
          hasUpdates = true;
        }

        if (trackedDependencies) {
          const previousDeps = this.computedDependencyCache.get(entry.path);
          this.computedDependencyCache.set(entry.path, trackedDependencies);

          if (
            !previousDeps ||
            previousDeps.size !== trackedDependencies.size ||
            Array.from(previousDeps).some(
              (dep) => !trackedDependencies.has(dep),
            )
          ) {
            this.invalidateReverseDeps();
          }
        }
      }

      if (!hasUpdates) break;

      if (resolution.requiresStabilizationPasses && i === maxPasses - 1) {
        throw new Error(
          "BitStore: computed fields did not stabilize. Check for cyclic computed definitions.",
        );
      }
    }

    // Clear cache for next apply() call
    this.equalityCache.clear();
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
      // If every entry already has known dependencies (either declared via
      // `computedDependsOn` or cached from a previous Proxy-tracked apply),
      // we can rely on the topological order produced by orderEntries() and
      // skip re-tracking + multi-pass stabilization — a single pass is enough.
      const allDepsKnown = entries.every(
        (e) =>
          e.dependsOn !== undefined || this.computedDependencyCache.has(e.path),
      );

      return {
        entries: this.orderEntries(entries),
        shouldTrackDependencies: !allDepsKnown,
        requiresStabilizationPasses: !allDepsKnown,
      };
    }

    const reverseDependencies = this.getReverseDependencies(entries);
    let shouldTrackDependencies = false;

    for (const entry of entries) {
      const dependencies = this.getDependenciesForEntry(entry);

      if (dependencies.length === 0) {
        shouldTrackDependencies = true;
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
    // Fast path: se o primeiro elemento já é um objeto normalizado (caso típico
    // quando getComputedEntries retorna BitComputedEntry[] do cache do BitStore),
    // evita o .map() e a alocação de array intermediário.
    if (entries.length === 0 || !Array.isArray(entries[0])) {
      return entries as BitComputedEntry<T>[];
    }
    return entries.map((entry) =>
      Array.isArray(entry)
        ? ({ path: entry[0], compute: entry[1] } satisfies BitComputedEntry<T>)
        : entry,
    );
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

    // Usa o índice de filhos (O(filhos)) em vez de varredura linear O(n).
    const childKeys = this.childDepsIndex?.get(changedPath);
    if (childKeys) {
      for (const childDep of childKeys) {
        collect(childDep);
      }
    }

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
