import type {
  BitFieldDefinition,
  BitNormalizeFn,
  BitTransformFn,
} from "../contracts/types";
import type { BitComputedEntry } from "../managers/core/computed-manager";

export class BitFieldCatalog<T extends object = any> {
  private readonly fieldConfigs: Map<string, BitFieldDefinition<T>> = new Map();

  private scopeFieldsIndex: Map<string, Set<string>> | null = null;
  private computedEntriesCache: BitComputedEntry<T>[] | null = null;
  private normalizerEntriesCache: [string, BitNormalizeFn<T>][] | null = null;
  private transformEntriesCache: [string, BitTransformFn<T>][] | null = null;

  get(path: string): BitFieldDefinition<T> | undefined {
    return this.fieldConfigs.get(path);
  }

  set(path: string, config: BitFieldDefinition<T>) {
    this.fieldConfigs.set(path, config);
    this.registerCachedIndexes(path, config);
  }

  delete(path: string): BitFieldDefinition<T> | undefined {
    const config = this.fieldConfigs.get(path);
    this.fieldConfigs.delete(path);
    this.unregisterCachedIndexes(path, config);
    return config;
  }

  has(path: string): boolean {
    return this.fieldConfigs.has(path);
  }

  forEach(callback: (config: BitFieldDefinition<T>, path: string) => void) {
    this.fieldConfigs.forEach((config, path) => callback(config, path));
  }

  entries(): [string, BitFieldDefinition<T>][] {
    return Array.from(this.fieldConfigs.entries());
  }

  getScopeFields(scopeName: string): string[] {
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

    return Array.from(this.scopeFieldsIndex.get(scopeName) ?? []);
  }

  getComputedEntries(): BitComputedEntry<T>[] {
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

    return this.computedEntriesCache;
  }

  getTransformEntries(): [string, BitTransformFn<T>][] {
    if (!this.transformEntriesCache) {
      const result: [string, BitTransformFn<T>][] = [];
      this.forEach((cfg, path) => {
        if (cfg.transform) {
          result.push([path, cfg.transform]);
        }
      });
      this.transformEntriesCache = result;
    }

    return this.transformEntriesCache;
  }

  getNormalizerEntries(): [string, BitNormalizeFn<T>][] {
    if (!this.normalizerEntriesCache) {
      const result: [string, BitNormalizeFn<T>][] = [];
      this.forEach((cfg, path) => {
        if (cfg.normalize) {
          result.push([path, cfg.normalize]);
        }
      });
      this.normalizerEntriesCache = result;
    }

    return this.normalizerEntriesCache;
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
      this.normalizerEntriesCache.push([path, config.normalize]);
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
        ([entryPath]) => entryPath !== path,
      );
    }

    if (this.transformEntriesCache && config.transform) {
      this.transformEntriesCache = this.transformEntriesCache.filter(
        ([entryPath]) => entryPath !== path,
      );
    }
  }
}
