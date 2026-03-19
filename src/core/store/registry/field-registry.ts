import { getDeepValue } from "../../utils";
import type { BitFieldDefinition, BitTransformFn } from "../contracts/types";
import type { BitComputedEntry } from "../managers/core/computed-manager";

export class BitFieldRegistry<T extends object = any> {
  private readonly fieldConfigs: Map<string, BitFieldDefinition<T>> = new Map();
  private readonly dependencies: Map<string, Set<string>> = new Map();
  private readonly hiddenFields: Set<string> = new Set();
  private readonly conditionalVisibilityPaths: Set<string> = new Set();
  private readonly requiredPathsByDependency: Map<string, Set<string>> =
    new Map();
  private readonly requiredConditionalPaths: Set<string> = new Set();
  private requiredEvaluationCache = new WeakMap<T, Map<string, boolean>>();
  private requiredEvaluationCacheDirty = false;

  private scopeFieldsIndex: Map<string, string[]> | null = null;
  private computedEntriesCache: BitComputedEntry<T>[] | null = null;
  private transformEntriesCache: [string, BitTransformFn<T>][] | null = null;

  getFieldConfig(path: string): BitFieldDefinition<T> | undefined {
    return this.fieldConfigs.get(path);
  }

  forEachFieldConfig(
    callback: (config: BitFieldDefinition<T>, path: string) => void,
  ) {
    this.fieldConfigs.forEach((config, path) => callback(config, path));
  }

  hasFieldConfig(path: string): boolean {
    return this.fieldConfigs.has(path);
  }

  getHiddenFields(): ReadonlySet<string> {
    return this.hiddenFields;
  }

  register(path: string, config: BitFieldDefinition<T>, currentValues: T) {
    this.fieldConfigs.set(path, config);

    if (config.conditional?.showIf) {
      this.conditionalVisibilityPaths.add(path);
    }

    const dependsOn = config.conditional?.dependsOn;
    if (dependsOn) {
      dependsOn.forEach((dep) => {
        if (!this.dependencies.has(dep)) {
          this.dependencies.set(dep, new Set());
        }
        this.dependencies.get(dep)!.add(path);
      });
    }

    const requiredDependsOn = config.conditional?.dependsOn;
    if (requiredDependsOn && config.conditional?.requiredIf) {
      this.requiredConditionalPaths.add(path);
      requiredDependsOn.forEach((dep) => {
        if (!this.requiredPathsByDependency.has(dep)) {
          this.requiredPathsByDependency.set(dep, new Set());
        }
        this.requiredPathsByDependency.get(dep)!.add(path);
      });
    }

    this.requiredEvaluationCacheDirty = true;
    this.registerCachedIndexes(path, config);
    this.evaluateFieldCondition(path, currentValues);
  }

  unregister(path: string) {
    const config = this.fieldConfigs.get(path);

    this.fieldConfigs.delete(path);
    this.hiddenFields.delete(path);
    this.conditionalVisibilityPaths.delete(path);
    this.dependencies.delete(path);
    this.requiredEvaluationCacheDirty = true;
    this.requiredConditionalPaths.delete(path);

    config?.conditional?.dependsOn?.forEach((dep) => {
      const requiredPaths = this.requiredPathsByDependency.get(dep);
      if (!requiredPaths) {
        return;
      }

      requiredPaths.delete(path);
      if (requiredPaths.size === 0) {
        this.requiredPathsByDependency.delete(dep);
      }
    });

    this.dependencies.forEach((dependentsSet) => {
      dependentsSet.delete(path);
    });

    this.unregisterCachedIndexes(path, config);
  }

  unregisterPrefix(prefix: string) {
    const removedEntries: [string, BitFieldDefinition<T>][] = [];

    this.fieldConfigs.forEach((config, path) => {
      if (path.startsWith(prefix)) {
        removedEntries.push([path, config]);
      }
    });

    removedEntries.forEach(([path]) => this.unregister(path));

    return removedEntries;
  }

  isHidden(path: string): boolean {
    return this.hiddenFields.has(path);
  }

  isRequired(path: string, values: T): boolean {
    const config = this.fieldConfigs.get(path);
    if (!config || this.isHidden(path)) return false;

    if (!config.conditional?.requiredIf) {
      return false;
    }

    if (this.requiredEvaluationCacheDirty) {
      this.requiredEvaluationCache = new WeakMap();
      this.requiredEvaluationCacheDirty = false;
    }

    let cache = this.requiredEvaluationCache.get(values);
    if (!cache) {
      cache = new Map<string, boolean>();
      this.requiredEvaluationCache.set(values, cache);
    }

    if (cache.has(path)) {
      return cache.get(path)!;
    }

    const result = !!config.conditional.requiredIf(values);
    cache.set(path, result);
    return result;
  }

  getRequiredErrors(values: T): Record<string, string> {
    const errors: Record<string, string> = {};

    this.requiredConditionalPaths.forEach((path) => {
      const config = this.fieldConfigs.get(path);
      if (!config) {
        return;
      }

      if (this.isRequired(path, values)) {
        const val = getDeepValue(values, path);
        if (this.isEmpty(val)) {
          errors[path] =
            config.conditional?.requiredMessage ?? "required field";
        }
      }
    });

    return errors;
  }

  evaluateAll(values: T) {
    this.conditionalVisibilityPaths.forEach((path) => {
      this.evaluateFieldCondition(path, values);
    });
  }

  updateDependencies(changedPath: string, newValues: T): string[] {
    const toggledFields: string[] = [];

    const queue = [changedPath];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const currentPath = queue.shift()!;

      if (visited.has(currentPath)) {
        continue;
      }

      visited.add(currentPath);

      const dependents = this.dependencies.get(currentPath);
      if (!dependents) {
        continue;
      }

      dependents.forEach((depPath) => {
        const wasHidden = this.isHidden(depPath);
        this.evaluateFieldCondition(depPath, newValues);
        const isHiddenNow = this.isHidden(depPath);

        if (wasHidden !== isHiddenNow) {
          toggledFields.push(depPath);
        }

        queue.push(depPath);
      });
    }

    return toggledFields;
  }

  getScopeFields(scopeName: string): string[] {
    if (!this.scopeFieldsIndex) {
      const index = new Map<string, string[]>();
      this.forEachFieldConfig((cfg, path) => {
        if (!cfg.scope) {
          return;
        }
        const list = index.get(cfg.scope) ?? [];
        list.push(path);
        index.set(cfg.scope, list);
      });
      this.scopeFieldsIndex = index;
    }

    return this.scopeFieldsIndex.get(scopeName) ?? [];
  }

  getComputedEntries(): BitComputedEntry<T>[] {
    if (!this.computedEntriesCache) {
      const result: BitComputedEntry<T>[] = [];
      this.forEachFieldConfig((cfg, path) => {
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
      this.forEachFieldConfig((cfg, path) => {
        if (cfg.transform) {
          result.push([path, cfg.transform]);
        }
      });
      this.transformEntriesCache = result;
    }

    return this.transformEntriesCache;
  }

  invalidateIndexes() {
    this.scopeFieldsIndex = null;
    this.computedEntriesCache = null;
    this.transformEntriesCache = null;
  }

  private registerCachedIndexes(path: string, config: BitFieldDefinition<T>) {
    if (this.scopeFieldsIndex && config.scope) {
      const scopedPaths = this.scopeFieldsIndex.get(config.scope) ?? [];
      if (!scopedPaths.includes(path)) {
        scopedPaths.push(path);
        this.scopeFieldsIndex.set(config.scope, scopedPaths);
      }
    }

    if (this.computedEntriesCache && config.computed) {
      this.computedEntriesCache.push({
        path,
        compute: config.computed,
        dependsOn: config.computedDependsOn,
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
        const nextPaths = scopedPaths.filter((fieldPath) => fieldPath !== path);
        if (nextPaths.length > 0) {
          this.scopeFieldsIndex.set(config.scope, nextPaths);
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

    if (this.transformEntriesCache && config.transform) {
      this.transformEntriesCache = this.transformEntriesCache.filter(
        ([entryPath]) => entryPath !== path,
      );
    }
  }

  private evaluateFieldCondition(path: string, values: T) {
    const config = this.fieldConfigs.get(path);
    const showIf = config?.conditional?.showIf;
    if (!showIf) return;

    if (showIf(values)) {
      this.hiddenFields.delete(path);
    } else {
      this.hiddenFields.add(path);
    }
  }

  private isEmpty(value: any): boolean {
    return (
      value === undefined ||
      value === null ||
      (typeof value === "string" && value.trim() === "") ||
      (Array.isArray(value) && value.length === 0)
    );
  }
}
