import type {
  BitFieldDefinition,
  BitNormalizeFn,
  BitTransformFn,
} from "../contracts/types";
import type { BitComputedEntry } from "../managers/core/computed-manager";
import {
  createWildcardRegex,
  expandWildcardPaths,
  isWildcardPath,
  resolveWildcardDependency,
} from "../../utils/path-wildcard";

export interface BitNormalizerEntry<
  T extends object = Record<string, unknown>,
> {
  path: string;
  normalize: BitNormalizeFn<T>;
  dependsOn: readonly string[];
}

export class BitFieldCatalog<T extends object = Record<string, unknown>> {
  private readonly fieldConfigs: Map<string, BitFieldDefinition<T>> = new Map();
  private readonly wildcardConfigs: Map<string, BitFieldDefinition<T>> = new Map();
  private readonly wildcardRegexes: Map<string, RegExp> = new Map();

  private scopeFieldsIndex: Map<string, Set<string>> | null = null;
  private computedEntriesCache: BitComputedEntry<T>[] | null = null;
  private normalizerEntriesCache: BitNormalizerEntry<T>[] | null = null;
  private transformEntriesCache: [string, BitTransformFn<T>][] | null = null;

  get(path: string): BitFieldDefinition<T> | undefined {
    const exact = this.fieldConfigs.get(path);
    if (exact) {
      return exact;
    }

    for (const [pattern, config] of this.wildcardConfigs.entries()) {
      const regex = this.wildcardRegexes.get(pattern);
      if (regex && regex.test(path)) {
        return config;
      }
    }

    return undefined;
  }

  set(path: string, config: BitFieldDefinition<T>) {
    if (isWildcardPath(path)) {
      this.wildcardConfigs.set(path, config);
      this.wildcardRegexes.set(path, createWildcardRegex(path));
    } else {
      this.fieldConfigs.set(path, config);
    }
    this.registerCachedIndexes(path, config);
  }

  delete(path: string): BitFieldDefinition<T> | undefined {
    let config: BitFieldDefinition<T> | undefined;

    if (isWildcardPath(path)) {
      config = this.wildcardConfigs.get(path);
      this.wildcardConfigs.delete(path);
      this.wildcardRegexes.delete(path);
    } else {
      config = this.fieldConfigs.get(path);
      this.fieldConfigs.delete(path);
    }

    this.unregisterCachedIndexes(path, config);
    return config;
  }

  has(path: string): boolean {
    if (this.fieldConfigs.has(path)) return true;
    if (this.wildcardConfigs.has(path)) return true;
    for (const regex of this.wildcardRegexes.values()) {
      if (regex.test(path)) return true;
    }
    return false;
  }

  forEach(callback: (config: BitFieldDefinition<T>, path: string) => void) {
    this.fieldConfigs.forEach((config, path) => callback(config, path));
    this.wildcardConfigs.forEach((config, path) => callback(config, path));
  }

  entries(): [string, BitFieldDefinition<T>][] {
    return [
      ...Array.from(this.fieldConfigs.entries()),
      ...Array.from(this.wildcardConfigs.entries()),
    ];
  }

  getScopeFields(scopeName: string, values: T): string[] {
    if (!this.scopeFieldsIndex) {
      const index = new Map<string, Set<string>>();
      this.forEach((cfg, path) => {
        if (!cfg.scope) {
          return;
        }
        const list = index.get(cfg.scope) ?? new Set<string>();
        list.add(path);
        index.set(cfg.scope, list);
      });
      this.scopeFieldsIndex = index;
    }

    const paths = Array.from(this.scopeFieldsIndex.get(scopeName) ?? []);
    if (paths.length === 0) return [];

    const result = new Set<string>();
    for (const path of paths) {
      if (isWildcardPath(path)) {
        const expanded = expandWildcardPaths(path, values);
        expanded.forEach((p) => result.add(p));
      } else {
        result.add(path);
      }
    }

    return Array.from(result);
  }

  getComputedEntries(values: T): BitComputedEntry<T>[] {
    if (!this.computedEntriesCache) {
      const result: BitComputedEntry<T>[] = [];
      this.forEach((cfg, path) => {
        if (cfg.computed) {
          result.push({
            path,
            compute: cfg.computed,
            dependsOn: cfg.computedDependsOn,
          });
        }
      });
      this.computedEntriesCache = result;
    }

    const finalEntries: BitComputedEntry<T>[] = [];
    for (const entry of this.computedEntriesCache) {
      if (isWildcardPath(entry.path)) {
        const expanded = expandWildcardPaths(entry.path, values);
        for (const concretePath of expanded) {
          finalEntries.push({
            path: concretePath,
            compute: (vals) => entry.compute(vals, concretePath),
            dependsOn: entry.dependsOn.map((dep) =>
              resolveWildcardDependency(dep, concretePath, entry.path),
            ),
          });
        }
      } else {
        finalEntries.push({
          path: entry.path,
          compute: (vals) => entry.compute(vals, entry.path),
          dependsOn: entry.dependsOn,
        });
      }
    }

    return finalEntries;
  }

  getTransformEntries(values: T): [string, BitTransformFn<T>][] {
    if (!this.transformEntriesCache) {
      const result: [string, BitTransformFn<T>][] = [];
      this.forEach((cfg, path) => {
        if (cfg.transform) {
          result.push([path, cfg.transform]);
        }
      });
      this.transformEntriesCache = result;
    }

    const finalEntries: [string, BitTransformFn<T>][] = [];
    for (const [path, transformFn] of this.transformEntriesCache) {
      if (isWildcardPath(path)) {
        const expanded = expandWildcardPaths(path, values);
        for (const concretePath of expanded) {
          finalEntries.push([
            concretePath,
            (val, allValues) => transformFn(val, allValues, concretePath) as unknown,
          ]);
        }
      } else {
        finalEntries.push([
          path,
          (val, allValues) => transformFn(val, allValues, path) as unknown,
        ]);
      }
    }

    return finalEntries;
  }

  getNormalizerEntries(values: T): BitNormalizerEntry<T>[] {
    if (!this.normalizerEntriesCache) {
      const result: BitNormalizerEntry<T>[] = [];
      this.forEach((cfg, path) => {
        if (cfg.normalize) {
          result.push({
            path,
            normalize: cfg.normalize,
            dependsOn: cfg.normalizeDependsOn?.length
              ? cfg.normalizeDependsOn
              : [path],
          });
        }
      });
      this.normalizerEntriesCache = result;
    }

    const finalEntries: BitNormalizerEntry<T>[] = [];
    for (const entry of this.normalizerEntriesCache) {
      if (isWildcardPath(entry.path)) {
        const expanded = expandWildcardPaths(entry.path, values);
        for (const concretePath of expanded) {
          finalEntries.push({
            path: concretePath,
            normalize: (val, allValues) =>
              entry.normalize(val, allValues, concretePath) as unknown,
            dependsOn: entry.dependsOn.map((dep) =>
              resolveWildcardDependency(dep, concretePath, entry.path),
            ),
          });
        }
      } else {
        finalEntries.push({
          path: entry.path,
          normalize: (val, allValues) =>
            entry.normalize(val, allValues, entry.path) as unknown,
          dependsOn: entry.dependsOn,
        });
      }
    }

    return finalEntries;
  }

  invalidateIndexes() {
    this.scopeFieldsIndex = null;
    this.computedEntriesCache = null;
    this.normalizerEntriesCache = null;
    this.transformEntriesCache = null;
  }

  private registerCachedIndexes(path: string, config: BitFieldDefinition<T>) {
    if (this.scopeFieldsIndex && config.scope) {
      const scopedPaths =
        this.scopeFieldsIndex.get(config.scope) ?? new Set<string>();
      scopedPaths.add(path);
      this.scopeFieldsIndex.set(config.scope, scopedPaths);
    }

    if (this.computedEntriesCache && config.computed) {
      this.computedEntriesCache.push({
        path,
        compute: config.computed,
        dependsOn: config.computedDependsOn,
      });
    }

    if (this.normalizerEntriesCache && config.normalize) {
      this.normalizerEntriesCache.push({
        path,
        normalize: config.normalize,
        dependsOn: config.normalizeDependsOn?.length
          ? config.normalizeDependsOn
          : [path],
      });
    }

    if (this.transformEntriesCache && config.transform) {
      this.transformEntriesCache.push([path, config.transform]);
    }
  }

  private unregisterCachedIndexes(
    path: string,
    config?: BitFieldDefinition<T>,
  ) {
    if (!config) {
      this.invalidateIndexes();
      return;
    }

    if (this.scopeFieldsIndex && config.scope) {
      const scopedPaths = this.scopeFieldsIndex.get(config.scope);
      if (scopedPaths) {
        scopedPaths.delete(path);

        if (scopedPaths.size > 0) {
          this.scopeFieldsIndex.set(config.scope, scopedPaths);
        } else {
          this.scopeFieldsIndex.delete(config.scope);
        }
      }
    }

    if (this.computedEntriesCache && config.computed) {
      this.computedEntriesCache = this.computedEntriesCache.filter(
        (entry) => entry.path !== path,
      );
    }

    if (this.normalizerEntriesCache && config.normalize) {
      this.normalizerEntriesCache = this.normalizerEntriesCache.filter(
        (entry) => entry.path !== path,
      );
    }

    if (this.transformEntriesCache && config.transform) {
      this.transformEntriesCache = this.transformEntriesCache.filter(
        ([entryPath]) => entryPath !== path,
      );
    }
  }
}
