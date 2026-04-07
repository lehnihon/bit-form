import { getDeepValue } from "../../utils";
import type { BitDependencyUpdateDiff } from "../contracts/port-types";
import type { BitErrors, BitFieldDefinition } from "../contracts/types";

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
    private readonly onConditionError?: (args: {
      path: string;
      kind: "showIf" | "requiredIf";
      error: unknown;
    }) => void,
  ) {}

  getHiddenFields(): ReadonlySet<string> {
    return this.hiddenFields;
  }

  onRegister(
    path: string,
    config: BitFieldDefinition<T>,
    currentValues: T,
  ): boolean {
    const hasShowIf = !!config.conditional?.showIf;
    const dependsOn = config.conditional?.dependsOn;
    if (dependsOn) {
      // CRITICAL: Detect circular dependencies early to prevent O(n²) complexity in updateDependencies
      if (this.wouldCreateCycle(path, dependsOn)) {
        const error = new Error(
          `Circular dependency detected: "${path}" → [${dependsOn.join(", ")}]`,
        );
        this.onConditionError?.({ path, kind: "showIf", error });
        // Fail-safe for production: only visibility-driven fields become hidden on cycle.
        if (hasShowIf) {
          this.hiddenFields.add(path);
        }
        this.conditionalVisibilityPaths.delete(path);
        this.requiredConditionalPaths.delete(path);
        return false;
      }

      dependsOn.forEach((dep) => {
        if (!this.dependencies.has(dep)) {
          this.dependencies.set(dep, new Set());
        }
        this.dependencies.get(dep)!.add(path);
      });
    }

    if (hasShowIf) {
      this.conditionalVisibilityPaths.add(path);
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

    return true;
  }

  onUnregister(
    path: string,
    config?: BitFieldDefinition<T>,
    options?: { preserveIncomingDependents?: boolean },
  ) {
    this.hiddenFields.delete(path);
    this.conditionalVisibilityPaths.delete(path);
    if (!options?.preserveIncomingDependents) {
      this.dependencies.delete(path);
    }
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

    let result = false;

    try {
      result = !!config.conditional.requiredIf(values);
    } catch (error) {
      this.onConditionError?.({ path, kind: "requiredIf", error });
    }

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

      // CRITICAL: Do not set error for hidden fields - prevents invisible validation errors
      if (this.isHidden(path)) {
        return;
      }

      if (this.isRequired(path, values)) {
        const val = getDeepValue(values, path);
        if (this.isEmpty(val)) {
          errors[path as keyof BitErrors<T>] = (config.conditional
            ?.requiredMessage ??
            "required field") as BitErrors<T>[keyof BitErrors<T>];
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

    try {
      if (showIf(values)) {
        this.hiddenFields.delete(path);
      } else {
        this.hiddenFields.add(path);
      }
    } catch (error) {
      this.onConditionError?.({ path, kind: "showIf", error });
    }
  }

  private wouldCreateCycle(newPath: string, dependsOn: string[]): boolean {
    // The dependencies map is reversed (dependency -> dependents).
    // Adding new edges (dep -> newPath) creates a cycle if newPath can already reach dep.
    for (const targetDependency of dependsOn) {
      const queue = [newPath];
      const visited = new Set<string>();

      while (queue.length > 0) {
        const current = queue.shift()!;

        if (current === targetDependency) {
          return true;
        }

        if (visited.has(current)) {
          continue;
        }

        visited.add(current);

        const dependents = this.dependencies.get(current);
        if (dependents) {
          queue.push(...dependents);
        }
      }
    }

    return false;
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
