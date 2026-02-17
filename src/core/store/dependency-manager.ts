import { BitFieldConfig } from "./types";
import { getDeepValue } from "./utils";

export class BitDependencyManager<T extends object = any> {
  public fieldConfigs: Map<string, BitFieldConfig<T>> = new Map();
  public dependencies: Map<string, Set<string>> = new Map();
  public hiddenFields: Set<string> = new Set();

  register(path: string, config: BitFieldConfig<T>, currentValues: T) {
    this.fieldConfigs.set(path, config);

    if (config.dependsOn) {
      config.dependsOn.forEach((dep) => {
        if (!this.dependencies.has(dep)) {
          this.dependencies.set(dep, new Set());
        }
        this.dependencies.get(dep)!.add(path);
      });
    }

    this.evaluateFieldCondition(path, currentValues);
  }

  isHidden(path: string): boolean {
    return this.hiddenFields.has(path);
  }

  isRequired(path: string, values: T): boolean {
    const config = this.fieldConfigs.get(path);
    if (!config || this.isHidden(path)) return false;
    return !!config.requiredIf?.(values);
  }

  getRequiredErrors(values: T): Record<string, string> {
    const errors: Record<string, string> = {};

    this.fieldConfigs.forEach((config, path) => {
      if (this.isRequired(path, values)) {
        const val = getDeepValue(values, path);
        if (this.isEmpty(val)) {
          errors[path] = "Este campo é obrigatório";
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
    const dependents = this.dependencies.get(changedPath);

    if (!dependents) return toggledFields;

    dependents.forEach((depPath) => {
      const wasHidden = this.isHidden(depPath);
      this.evaluateFieldCondition(depPath, newValues);
      const isHiddenNow = this.isHidden(depPath);

      if (wasHidden !== isHiddenNow) {
        toggledFields.push(depPath);
      }
    });

    return toggledFields;
  }

  unregister(path: string) {
    this.fieldConfigs.delete(path);
    this.hiddenFields.delete(path);
    this.dependencies.delete(path);

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
    if (!config?.showIf) return;

    if (config.showIf(values)) {
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
