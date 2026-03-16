import { BitFieldDefinition } from "../../contracts/types";
import { getDeepValue } from "../../../utils";

export class BitDependencyManager<T extends object = any> {
  private readonly fieldConfigs: Map<string, BitFieldDefinition<T>> = new Map();
  private readonly dependencies: Map<string, Set<string>> = new Map();
  private readonly hiddenFields: Set<string> = new Set();
  private readonly requiredPathsByDependency: Map<string, Set<string>> =
    new Map();
  private requiredEvaluationCache = new WeakMap<T, Map<string, boolean>>();

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
      requiredDependsOn.forEach((dep) => {
        if (!this.requiredPathsByDependency.has(dep)) {
          this.requiredPathsByDependency.set(dep, new Set());
        }
        this.requiredPathsByDependency.get(dep)!.add(path);
      });
    }

    this.requiredEvaluationCache = new WeakMap();

    this.evaluateFieldCondition(path, currentValues);
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

    this.fieldConfigs.forEach((config, path) => {
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
    this.fieldConfigs.forEach((_, path) => {
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

  unregister(path: string) {
    const config = this.fieldConfigs.get(path);

    this.fieldConfigs.delete(path);
    this.hiddenFields.delete(path);
    this.dependencies.delete(path);
    this.requiredEvaluationCache = new WeakMap();

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
  }

  unregisterPrefix(prefix: string) {
    const pathsToRemove: string[] = [];

    this.fieldConfigs.forEach((_, path) => {
      if (path.startsWith(prefix)) {
        pathsToRemove.push(path);
      }
    });

    pathsToRemove.forEach((path) => this.unregister(path));
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
