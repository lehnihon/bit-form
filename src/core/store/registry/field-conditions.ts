import { getDeepValue } from "../../utils";
import type { BitErrors, BitFieldDefinition } from "../contracts/types";
import type { BitDependencyUpdateDiff } from "../contracts/port-types";

export class BitFieldConditions<T extends object = Record<string, unknown>> {
  private readonly dependencies: Map<string, Set<string>> = new Map();
  private readonly hiddenFields: Set<string> = new Set();
  private readonly conditionalVisibilityPaths: Set<string> = new Set();
  private readonly requiredPathsByDependency: Map<string, Set<string>> =
    new Map();
  private readonly requiredConditionalPaths: Set<string> = new Set();
  private requiredEvaluationVersion = 0;
  private readonly requiredEvaluationCache = new Map<
    string,
    {
      version: number;
      valuesRef: T;
      result: boolean;
    }
  >();

  constructor(
    private readonly getFieldConfig: (
      path: string,
    ) => BitFieldDefinition<T> | undefined,
  ) {}

  getHiddenFields(): ReadonlySet<string> {
    return this.hiddenFields;
  }

  onRegister(path: string, config: BitFieldDefinition<T>, currentValues: T) {
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

    if (dependsOn && config.conditional?.requiredIf) {
      this.requiredConditionalPaths.add(path);
      dependsOn.forEach((dep) => {
        if (!this.requiredPathsByDependency.has(dep)) {
          this.requiredPathsByDependency.set(dep, new Set());
        }
        this.requiredPathsByDependency.get(dep)!.add(path);
      });
    }

    this.requiredEvaluationVersion += 1;
    this.requiredEvaluationCache.clear();
    this.evaluateFieldCondition(path, currentValues);
  }

  onUnregister(path: string, config?: BitFieldDefinition<T>) {
    this.hiddenFields.delete(path);
    this.conditionalVisibilityPaths.delete(path);
    this.dependencies.delete(path);
    this.requiredEvaluationVersion += 1;
    this.requiredEvaluationCache.clear();
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
  }

  isHidden(path: string): boolean {
    return this.hiddenFields.has(path);
  }

  hasDependents(path: string): boolean {
    return (this.dependencies.get(path)?.size ?? 0) > 0;
  }

  isRequired(path: string, values: T): boolean {
    const config = this.getFieldConfig(path);
    if (!config || this.isHidden(path)) return false;

    if (!config.conditional?.requiredIf) {
      return false;
    }

    const cached = this.requiredEvaluationCache.get(path);
    if (
      cached &&
      cached.version === this.requiredEvaluationVersion &&
      cached.valuesRef === values
    ) {
      return cached.result;
    }

    const result = !!config.conditional.requiredIf(values);
    this.requiredEvaluationCache.set(path, {
      version: this.requiredEvaluationVersion,
      valuesRef: values,
      result,
    });
    return result;
  }

  getRequiredErrors(values: T): BitErrors<T> {
    const errors: BitErrors<T> = {};

    this.requiredConditionalPaths.forEach((path) => {
      const config = this.getFieldConfig(path);
      if (!config) {
        return;
      }

      if (this.isRequired(path, values)) {
        const val = getDeepValue(values, path);
        if (this.isEmpty(val)) {
          errors[path as keyof BitErrors<T>] = (config.conditional
            ?.requiredMessage ?? "required field") as BitErrors<T>[keyof BitErrors<T>];
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

  updateDependencies(
    changedPath: string,
    currentValues: T,
    newValues: T,
  ): BitDependencyUpdateDiff {
    const affectedFields = new Set<string>();
    const visibilityChanged = new Set<string>();
    const requiredChanged = new Set<string>();

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
        affectedFields.add(depPath);

        const wasHidden = this.isHidden(depPath);
        const wasRequired = this.isRequired(depPath, currentValues);
        this.evaluateFieldCondition(depPath, newValues);
        const isHiddenNow = this.isHidden(depPath);
        const isRequiredNow = this.isRequired(depPath, newValues);

        if (wasHidden !== isHiddenNow) {
          visibilityChanged.add(depPath);
        }

        if (wasRequired !== isRequiredNow) {
          requiredChanged.add(depPath);
        }

        queue.push(depPath);
      });
    }

    return {
      affectedFields: Array.from(affectedFields),
      visibilityChanged: Array.from(visibilityChanged),
      requiredChanged: Array.from(requiredChanged),
    };
  }

  private evaluateFieldCondition(path: string, values: T) {
    const config = this.getFieldConfig(path);
    const showIf = config?.conditional?.showIf;
    if (!showIf) return;

    if (showIf(values)) {
      this.hiddenFields.delete(path);
    } else {
      this.hiddenFields.add(path);
    }
  }

  private isEmpty(value: unknown): boolean {
    return (
      value === undefined ||
      value === null ||
      (typeof value === "string" && value.trim() === "") ||
      (Array.isArray(value) && value.length === 0)
    );
  }
}
