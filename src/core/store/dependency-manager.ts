import { BitFieldConfig } from "./types";

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

    if (config.showIf) {
      if (!config.showIf(currentValues)) {
        this.hiddenFields.add(path);
      } else {
        this.hiddenFields.delete(path);
      }
    }
  }

  isHidden(path: string): boolean {
    return this.hiddenFields.has(path);
  }

  evaluateAll(values: T) {
    this.fieldConfigs.forEach((config, path) => {
      if (config.showIf) {
        if (!config.showIf(values)) {
          this.hiddenFields.add(path);
        } else {
          this.hiddenFields.delete(path);
        }
      }
    });
  }

  updateDependencies(changedPath: string, newValues: T): string[] {
    const toggledFields: string[] = [];
    if (!this.dependencies.has(changedPath)) return toggledFields;

    const dependents = this.dependencies.get(changedPath)!;
    dependents.forEach((depPath) => {
      const config = this.fieldConfigs.get(depPath);
      if (config?.showIf) {
        const shouldShow = config.showIf(newValues);
        const wasHidden = this.hiddenFields.has(depPath);

        if (shouldShow && wasHidden) {
          this.hiddenFields.delete(depPath);
          toggledFields.push(depPath);
        } else if (!shouldShow && !wasHidden) {
          this.hiddenFields.add(depPath);
          toggledFields.push(depPath);
        }
      }
    });

    return toggledFields;
  }
}
