import type { BitFieldDefinition, BitTransformFn } from "../contracts/types";
import type { BitComputedEntry } from "../managers/core/computed-manager";
import { BitFieldCatalog } from "./field-catalog";
import { BitFieldConditions } from "./field-conditions";

export class BitFieldRegistry<T extends object = any> {
  private readonly catalog = new BitFieldCatalog<T>();
  private readonly conditions = new BitFieldConditions<T>((path) =>
    this.catalog.get(path),
  );

  getFieldConfig(path: string): BitFieldDefinition<T> | undefined {
    return this.catalog.get(path);
  }

  forEachFieldConfig(
    callback: (config: BitFieldDefinition<T>, path: string) => void,
  ) {
    this.catalog.forEach((config, path) => callback(config, path));
  }

  hasFieldConfig(path: string): boolean {
    return this.catalog.has(path);
  }

  getHiddenFields(): ReadonlySet<string> {
    return this.conditions.getHiddenFields();
  }

  register(path: string, config: BitFieldDefinition<T>, currentValues: T) {
    this.catalog.set(path, config);
    this.conditions.onRegister(path, config, currentValues);
  }

  unregister(path: string) {
    const config = this.catalog.delete(path);
    this.conditions.onUnregister(path, config);
  }

  unregisterPrefix(prefix: string) {
    const removedEntries: [string, BitFieldDefinition<T>][] = [];

    this.catalog.forEach((config, path) => {
      if (path.startsWith(prefix)) {
        removedEntries.push([path, config]);
      }
    });

    removedEntries.forEach(([path]) => this.unregister(path));

    return removedEntries;
  }

  isHidden(path: string): boolean {
    return this.conditions.isHidden(path);
  }

  hasDependents(path: string): boolean {
    return this.conditions.hasDependents(path);
  }

  isRequired(path: string, values: T): boolean {
    return this.conditions.isRequired(path, values);
  }

  getRequiredErrors(values: T): Record<string, string> {
    return this.conditions.getRequiredErrors(values) as Record<string, string>;
  }

  evaluateAll(values: T) {
    this.conditions.evaluateAll(values);
  }

  updateDependencies(changedPath: string, newValues: T): string[] {
    return this.conditions.updateDependencies(changedPath, newValues);
  }

  getScopeFields(scopeName: string): string[] {
    return this.catalog.getScopeFields(scopeName);
  }

  getComputedEntries(): BitComputedEntry<T>[] {
    return this.catalog.getComputedEntries();
  }

  getTransformEntries(): [string, BitTransformFn<T>][] {
    return this.catalog.getTransformEntries();
  }

  invalidateIndexes() {
    this.catalog.invalidateIndexes();
  }
}
