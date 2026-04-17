import type { BitDependencyUpdateDiff } from "../contracts/port-types";
import type { BitFieldDefinition, BitTransformFn } from "../contracts/types";
import type { BitComputedEntry } from "../managers/core/computed-manager";
import { isPathWithinPrefix, normalizePathPrefix } from "../shared/path-prefix";
import { BitFieldCatalog, type BitNormalizerEntry } from "./field-catalog";
import { BitFieldConditions } from "./field-conditions";
import type { BitFieldMetadataProvider } from "./field-metadata-provider";

export class BitFieldRegistry<
  T extends object = Record<string, unknown>,
> implements BitFieldMetadataProvider<T> {
  private readonly catalog = new BitFieldCatalog<T>();
  private readonly conditions: BitFieldConditions<T>;

  constructor(
    onConditionError?: (args: {
      path: string;
      kind: "showIf" | "requiredIf";
      error: unknown;
    }) => void,
  ) {
    this.conditions = new BitFieldConditions<T>(
      (path) => this.catalog.get(path),
      onConditionError,
    );
  }

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
    const previousConfig = this.catalog.get(path);
    if (previousConfig) {
      this.conditions.onUnregister(path, previousConfig, {
        preserveIncomingDependents: true,
      });
    }

    this.catalog.set(path, config);
    const didRegister = this.conditions.onRegister(path, config, currentValues);

    if (didRegister || !previousConfig) {
      return;
    }

    // Rollback to previous field config when re-register fails (e.g. cycle).
    this.catalog.set(path, previousConfig);
    this.conditions.onRegister(path, previousConfig, currentValues);
  }

  unregister(path: string) {
    const config = this.catalog.delete(path);
    this.conditions.onUnregister(path, config);
  }

  unregisterPrefix(prefix: string) {
    const removedEntries: [string, BitFieldDefinition<T>][] = [];
    const normalizedPrefix = normalizePathPrefix(prefix);

    if (normalizedPrefix.length === 0) {
      return removedEntries;
    }

    this.catalog.forEach((config, path) => {
      if (isPathWithinPrefix(path, normalizedPrefix)) {
        removedEntries.push([path, config]);
      }
    });

    // Batch unregister all at once instead of calling unregister N times
    // This avoids N separate invalidations
    removedEntries.forEach(([path, config]) => {
      this.catalog.delete(path);
      this.conditions.onUnregister(path, config);
    });

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

  updateDependencies(
    changedPath: string,
    currentValues: T,
    newValues: T,
  ): BitDependencyUpdateDiff {
    return this.conditions.updateDependencies(
      changedPath,
      currentValues,
      newValues,
    );
  }

  getScopeFields(scopeName: string, values: T): string[] {
    return this.catalog.getScopeFields(scopeName, values);
  }

  getComputedEntries(values: T): BitComputedEntry<T>[] {
    return this.catalog.getComputedEntries(values);
  }

  getTransformEntries(values: T): [string, BitTransformFn<T>][] {
    return this.catalog.getTransformEntries(values);
  }

  getNormalizerEntries(values: T): BitNormalizerEntry<T>[] {
    return this.catalog.getNormalizerEntries(values);
  }

  invalidateIndexes() {
    this.catalog.invalidateIndexes();
  }
}
